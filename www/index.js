"use strict"
import * as wasm from "wasm-game-of-life";
import { Universe, Cell } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";
import { GridShaderProgram } from "./grid.js";
import { createShader, createProgram } from "./shader.js";
import { App, ClickListener, GridDrawer, RenderLoop } from "./gameApp.js";
import { FPS } from "./fps.js";
import { createAndSetupTexture, ErrorDeco } from "./helpers.js";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#434C5E";
const GRID_COLOR_A = new Float32Array([0.2627, 0.298, 0.368]);
const DEAD_COLOR = "#434C5E";
const ALIVE_COLOR = "#CCCCFF";
const ALIVE_COLOR_A = new Float32Array([0.8, 0.8, 1]);

const norm = (x) => {
    // const val = canvas.width / 2;
    // return (x - val) / val;
    return x;
}

const bitIsSet = (n, arr) => {
    const byte = Math.floor(n / 8);
    const mask = 1 << (n % 8);
    return (arr[byte] & mask) === mask;
};

class KernelSet {
    constructor(gl, kernelLocation, kernelWeightLocation) {
        this.gl = gl;
        this.kernelLocation = kernelLocation;
        this.kernelWeightLocation = kernelWeightLocation;
        this.kernels = {
            normal: [
                0, 0, 0,
                0, 1, 0,
                0, 0, 0
            ],
            gaussianBlur: [
                0.045, 0.122, 0.045,
                0.122, 0.332, 0.122,
                0.045, 0.122, 0.045
            ],
            unsharpen: [
                -1, -1, -1,
                -1,  9, -1,
                -1, -1, -1
            ],
            emboss: [
                -2, -1,  0,
                -1,  1,  1,
                0,  1,  2
            ]
        };
    }

    get(name) {
        return this.kernels[name];
    }

    names() {
        return Object.keys(this.kernels);
    }

    draw(name, count) {
        // set the kernel
        const val = this.get(name);
        if (val === undefined) {
            console.log(`unable to get kernel`, {name: name, val: val});
        }
        this.gl.uniform1fv(this.kernelLocation, val);
        this.gl.uniform1f(this.kernelWeightLocation, computeKernelWeight(this.get(name)));
        // Draw the rectangle.
        this.gl.drawArrays(this.gl.TRIANGLES, 0, count);
    }
}

class Attachment {
    constructor(gl, image) {
        this.gl = gl;
        this.texture = createAndSetupTexture(gl);
        // make the texture the same size as the image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        // Create a framebuffer
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        // Attach a texture to it.
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    }

    setFramebuffer(resolutionLocation, width, height) {
        setFramebuffer(this.gl, this.framebuffer, resolutionLocation, width, height);
    }
}

function computeKernelWeight(kernel) {
    const weight = kernel.reduce((a, b) => a + b);
    return weight <= 0 ? 1 : weight;
}

function setFramebuffer(gl, fbo, resolutionLocation, width, height) {
    // make this the framebuffer we are rendering to.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Tell the shader the resolution of the framebuffer.
    // gl.uniform2f(resolutionLocation, width, height);

    // Tell webgl the viewport setting needed for framebuffer.
    // gl.viewport(0, 0, width, height);
}

function newRectangle(x, y, w, h) {
    return new Float32Array([
        x, y,
        x, y + h,
        x + w, y,

        x + w, y,
        x, y + h,
        x + w, y + h,
    ]);
}

class BasicMesh {
    constructor(gl, attribLocation) {
        this.gBuf = gl.createBuffer();
        this.gl = gl;
        this.attribLocation = attribLocation;
    }

    bind(data) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gBuf);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
        // enable vertex for drawing
        this.gl.enableVertexAttribArray(this.attribLocation);
        const
            index = this.attribLocation,
            size = 2,
            type = this.gl.FLOAT,
            normalized = false,
            stride = 0,
            offset = 0;
        this.gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
        return this;
    }
}

function fLetterPositions(letterLineWidth, letterHeight) {
    const topPlane = newRectangle(letterLineWidth, 0., 200, letterLineWidth);
    const middlePlane = newRectangle(letterLineWidth, letterHeight / 2, 150, letterLineWidth);
    const verticalPlane = newRectangle(0., 0., letterLineWidth, letterHeight);

    const cellPositions = new Float32Array(topPlane.length + middlePlane.length + verticalPlane.length);
    cellPositions.set(topPlane);
    cellPositions.set(middlePlane, topPlane.length);
    cellPositions.set(verticalPlane, topPlane.length + middlePlane.length);
    return cellPositions;
}

function loadBufferLearn(gl, vertexShader, fragmentShader, program) {
    const squareHeight = .1;
    const squareWidth = .5;
    const letterLineWidth = 50.;
    const letterHeight = 300;
    const texWidth = 1.;
    const texHeight = 1.;
    const battlecruiserImage = new Image();

    gl.useProgram(program);
    battlecruiserImage.src = 'http://localhost:8080/image.png';
    battlecruiserImage.onload = () => {
        const glErrorDeco = new ErrorDeco(gl);
        // vertex shader set a_position
        
        const cellPositions = fLetterPositions(letterLineWidth, letterHeight);
        new BasicMesh(gl, gl.getAttribLocation(program, "a_position")).bind(cellPositions);

        new BasicMesh(gl, gl.getAttribLocation(program, "a_texCoord"))
            .bind(newRectangle(0., 0., texWidth, texHeight));

        // vertex shader set u_translation
        const u_translationLoc = gl.getUniformLocation(program, "u_translation");
        gl.uniform2fv(u_translationLoc, [100, 0]);

        // vertex shader set u_resolution
        const u_resolutionLoc = gl.getUniformLocation(program, "u_resolution");
        gl.uniform2fv(u_resolutionLoc, [gl.canvas.width, gl.canvas.height]);

        const u_textureResolutionLoc = gl.getUniformLocation(program, "u_textureResolution");
        gl.uniform2fv(u_textureResolutionLoc, [battlecruiserImage.width, battlecruiserImage.height]);

        const u_textureSizeLoc = gl.getUniformLocation(program, "u_textureSize");
        gl.uniform2fv(u_textureSizeLoc, [battlecruiserImage.width, battlecruiserImage.height]);

        const u_kernelWeightLoc = gl.getUniformLocation(program, "u_kernelWeight");

        const originalTexture = createAndSetupTexture(gl);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, battlecruiserImage);

        // framebuffer experiments
        const attachments = [
            new Attachment(gl, battlecruiserImage),
            new Attachment(gl, battlecruiserImage),
        ];

        const kernelLoc = gl.getUniformLocation(program, "u_kernel[0]");
        const kernelSet = new KernelSet(gl, kernelLoc, u_kernelWeightLoc);

        const flipLoc = gl.getUniformLocation(program, "u_flip");
        gl.clear(gl.COLOR_BUFFER_BIT);
        const draw = flags => {
            gl.bindTexture(gl.TEXTURE_2D, originalTexture);

            const drawFrameBuffers = () => {
                gl.uniform1f(flipLoc, 1);
                const names = kernelSet.names();
                let count = 0;
                for (let i = 0; i < names.length; ++i) {
                    if ((flags & (1 << i)) == 0) {
                        continue;
                    }

                    const kernelName = names[i];
                    const att = attachments[count % 2];
                    att.setFramebuffer(u_resolutionLoc, battlecruiserImage.width, battlecruiserImage.height);
                    console.log(`is fbo ready`,
                        gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE);
                    kernelSet.draw(kernelName);
                    gl.bindTexture(gl.TEXTURE_2D, att.texture);
                    // gl.bindTexture(gl.TEXTURE_2D, textures[count % 2]);
                    glErrorDeco.print(gl.getError());
                    ++count;
                }
            }
            drawFrameBuffers();

            gl.uniform1f(flipLoc, -1);
            setFramebuffer(gl, null, u_resolutionLoc, battlecruiserImage.width, battlecruiserImage.height);
            gl.clear(gl.COLOR_BUFFER_BIT);
            kernelSet.draw('normal', cellPositions.length / 2);
            console.log('flags', flags.toString(2));
        }
        // gl.clear(gl.COLOR_BUFFER_BIT);
        // gl.drawArrays(gl.TRIANGLES, 0, 6);

        draw(0b0000);
        // const delayDraw = (x) => {
        //     draw(x);
        //     return new Promise((resolve, reject) => setTimeout(resolve, 2000));
        // }

        // new Promise((resolve, reject) => setTimeout(() => resolve(), 2000))
        //     .then(() => delayDraw(0b1111))
        //     .then(() => delayDraw(0b0011))
        //     .then(() => delayDraw(0b1111))
        //     .then(() => delayDraw(0b1001))
        //     .then(() => delayDraw(0b0111))
        //     .then(() => delayDraw(0b0011))
        // ;
    }
}

function newCanvas(selector, w, h) {
    const canvas = document.getElementById("game-of-life-canvas");
    if (!canvas) {
        return;
    }
    canvas.height = h;
    canvas.width = w;
    return canvas;
}

(function(){
    const canvas = newCanvas("game-of-life-canvas", 1200, 676);
    const gl = canvas.getContext('webgl', {
        antialias: true,
    });
    if (!gl) {
        alert('WebGL not working');
        return;
    }

    gl.lineWidth(1);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const vertexShaderSource = document.getElementById("2d-vertex-shader").text;
    const fragmentShaderSource = document.getElementById("2d-fragment-shader").text;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const simplePointProgram = createProgram(gl, vertexShader, fragmentShader);

    loadBufferLearn(gl, vertexShader, fragmentShader, simplePointProgram)
})();

// main function of game application.
function gameMain(){
    const universe = Universe.new();
    const universeWidth = universe.width();
    const universeHeight = universe.height();
    const canvas = newCanvas(
        "game-of-life-canvas",
        (CELL_SIZE + 1) * universeWidth + 1,
        (CELL_SIZE + 1) * universeWidth + 1,
    );
    if (!canvas) {
        console.log('fail init canvas');
        return;
    }

    const gl = canvas.getContext('webgl', {
        antialias: true,
    });
    if (!gl) {
        alert('WebGL not working');
        return;
    }
    gl.lineWidth(1);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);


    const cellPositions = new Float32Array([
        0.0, 0.0,
        0.0, 100.0,
        100.0, 0.0,

        100.0, 0.0,
        0.0, 100.0,
        100.0, 100.0,
    ]);

    const singleCellShaderProgram = new GridShaderProgram(gl, simplePointProgram, gl.TRIANGLES, cellPositions);
    const cellVertexData = new Float32Array(12 * universeWidth * universeHeight);
    const fps = new FPS();
    let animationId = null;
    const isPaused = () => {
        return animationId === null;
    };

    const gridDrawer = new GridDrawer(fieldGridShaderProgram, GRID_COLOR_A);

    const app = new App(universe, gl, CELL_SIZE, DEAD_COLOR, ALIVE_COLOR_A);
    const gridPositions = app.computeGridPositions();
    const fieldGridShaderProgram = new GridShaderProgram(
        gl, simplePointProgram, gl.LINES, gridPositions, 
    );
    const gameRenderLoop = new RenderLoop(app, gridDrawer, fps);

    const playPauseButton = document.getElementById("play-pause");
    const play = () => {
        playPauseButton.textContent = "⏸";
        gameRenderLoop.tick();
    };
    play();
    const pause = () => {
        playPauseButton.textContent = "▶";
        gameRenderLoop.pause();
    };

    playPauseButton.addEventListener("click", ev => (isPaused()) ? play() : pause());


    const canvasClickEventListener = new ClickEventListener(
        canvas, CELL_SIZE, universe, app, singleCellShaderProgram, cellVertexData, gridDrawer,
    );
    canvas.addEventListener("click", canvasClickEventListener.handle);
}
