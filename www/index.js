"use strict"
import * as wasm from "wasm-game-of-life";
import { Universe, Cell, KernelSet } from "wasm-game-of-life";
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

const bitIsSet = (n, arr) => {
    const byte = Math.floor(n / 8);
    const mask = 1 << (n % 8);
    return (arr[byte] & mask) === mask;
};

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

    setFramebuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    }
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
        if (attribLocation == -1) {
            console.log(`invalid value of attrib location`)
        }
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
    const topPlane = newRectangle(letterLineWidth, 0., letterHeight / 2, letterLineWidth);
    const middlePlane = newRectangle(letterLineWidth, letterHeight / 2, letterHeight / 3, letterLineWidth);
    const verticalPlane = newRectangle(0., 0., letterLineWidth, letterHeight);

    const cellPositions = new Float32Array(topPlane.length + middlePlane.length + verticalPlane.length);
    cellPositions.set(topPlane);
    cellPositions.set(middlePlane, topPlane.length);
    cellPositions.set(verticalPlane, topPlane.length + middlePlane.length);
    return cellPositions;
}

class EffectFilter {
    constructor(gl, img, kernelSet, canvasResolutionLoc) {
        this.gl = gl;
        this.attachments = [new Attachment(gl, img), new Attachment(gl, img)];
        this.originalTexture = createAndSetupTexture(gl);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        this.kernelSet = kernelSet;
        this.img = img;
        this.canvasResolutionLoc = canvasResolutionLoc;
        this.glErrorDeco = new ErrorDeco(gl);
    }

    draw(flags, drawCount) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.originalTexture);
        let err = this.gl.getError();
        if (err != this.gl.NO_ERROR) {
            console.log(`bindTexture`, this.glErrorDeco.string(err));
        }

        // const names = this.kernelSet.names();
        let count = 0;
        const len = this.kernelSet.len();
        for (let i = 0; i < len; ++i) {
            if ((flags & (1 << i)) == 0) {
                continue;
            }

            // const kernelName = names[i];
            const att = this.attachments[count % 2];
            att.setFramebuffer();
            err = this.gl.getError();
            if (err != this.gl.NO_ERROR) {
                console.log(`set framebuffer`, this.glErrorDeco.string(err));
            }

            console.log(`is fbo ready`,
                this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) == this.gl.FRAMEBUFFER_COMPLETE);
            this.kernelSet.draw(i, drawCount);
            this.gl.bindTexture(this.gl.TEXTURE_2D, att.texture);
            err = this.gl.getError()
            if (err != this.gl.NO_ERROR) {
                console.log(`bindTexture`, this.glErrorDeco.string(err));
            }

            ++count;
        }
    }
}

function loadBufferLearn(gl, vertexShader, fragmentShader, program) {
    const squareHeight = .1;
    const squareWidth = .5;
    const letterLineWidth = 20.;
    const letterHeight = 100;
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

        // new BasicMesh(gl, gl.getAttribLocation(program, "a_texCoord"))
        //     .bind(newRectangle(0., 0., texWidth, texHeight));

        // vertex shader set u_translation
        const u_translationLoc = gl.getUniformLocation(program, "u_translation");
        gl.uniform2fv(u_translationLoc, [150, 150]);

        // vertex shader set u_resolution
        const u_resolutionLoc = gl.getUniformLocation(program, "u_resolution");
        gl.uniform2fv(u_resolutionLoc, [gl.canvas.width, gl.canvas.height]);

        const u_textureResolutionLoc = gl.getUniformLocation(program, "u_textureResolution");
        gl.uniform2fv(u_textureResolutionLoc, [battlecruiserImage.width, battlecruiserImage.height]);

        const u_textureSizeLoc = gl.getUniformLocation(program, "u_textureSize");
        gl.uniform2fv(u_textureSizeLoc, [battlecruiserImage.width, battlecruiserImage.height]);

        // vertex shader set u_resolution
        const u_rotationLoc = gl.getUniformLocation(program, "u_rotation");
        gl.uniform2fv(u_rotationLoc, [0., 1]);


        const originalTexture = createAndSetupTexture(gl);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, battlecruiserImage);

        // framebuffer experiments
        const attachments = [
            new Attachment(gl, battlecruiserImage),
            new Attachment(gl, battlecruiserImage),
        ];

        const kernelLoc = gl.getUniformLocation(program, "u_kernel[0]");
        const u_kernelWeightLoc = gl.getUniformLocation(program, "u_kernelWeight");
        const kernelSet = KernelSet.new(gl, kernelLoc, u_kernelWeightLoc);

        const flipLoc = gl.getUniformLocation(program, "u_flip");
        gl.clear(gl.COLOR_BUFFER_BIT);

        const effectFilter = new EffectFilter(gl, battlecruiserImage, kernelSet, u_resolutionLoc);
        const draw = flags => {
            gl.bindTexture(gl.TEXTURE_2D, originalTexture);

            gl.uniform1f(flipLoc, 1);
            effectFilter.draw(flags, cellPositions.length / 2);

            gl.uniform1f(flipLoc, -1);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.clear(gl.COLOR_BUFFER_BIT);
            kernelSet.draw('normal', cellPositions.length / 2);
            console.log('flags', flags.toString(2));
        }
        // gl.clear(gl.COLOR_BUFFER_BIT);
        // gl.drawArrays(gl.TRIANGLES, 0, 6);

        draw(0b1001);
        const delayDraw = (angle) => {
            gl.uniform2fv(u_rotationLoc, fromAngle(angle));
            draw(0b1001);
            return new Promise((resolve, reject) => setTimeout(resolve, 2000));
        }

        const fromAngle = (degrees) => {
            const radians = degrees * Math.PI / 180;
            return [
                Math.sin(radians),
                Math.cos(radians),
            ];
        }
        new Promise((resolve, reject) => setTimeout(() => resolve(), 2000))
        //     .then(() => delayDraw(0b1111))
        //     .then(() => delayDraw(0b0011))
        //     .then(() => delayDraw(0b1111))
             .then(() => delayDraw(0))
             .then(() => delayDraw(10))
             .then(() => delayDraw(20))
             .then(() => delayDraw(30))
             .then(() => delayDraw(40))
             .then(() => delayDraw(50))
             .then(() => delayDraw(60))
             .then(() => delayDraw(70))
             .then(() => delayDraw(80))
             .then(() => delayDraw(90))
        //      .then(() => delayDraw(0., -1.))
        ;
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
