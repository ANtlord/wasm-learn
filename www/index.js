"use strict"
import * as wasm from "wasm-game-of-life";
import { Universe, Cell } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";
import { GridShaderProgram } from "./grid.js";
import { createShader, createProgram } from "./shader.js";
import { App } from "./gameApp.js";
import { FPS } from "./fps.js";

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

function createAndSetupTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

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

    draw(name) {
        // set the kernel
        const val = this.get(name);
        if (val === undefined) {
            console.log(`unable to get kernel`, {name: name, val: val});
        }
        this.gl.uniform1fv(this.kernelLocation, val);
        this.gl.uniform1f(this.kernelWeightLocation, computeKernelWeight(this.get(name)));
        // Draw the rectangle.
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
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

class ErrorDeco {
    constructor(gl) {
        this.gl = gl;
    }

    string(e) {
        switch (e) {
            case this.gl.NO_ERROR:
                return "NO_ERROR";
            case this.gl.INVALID_ENUM:
                return "INVALID_ENUM";
            case this.gl.INVALID_VALUE:
                return "INVALID_VALUE";
            case this.gl.INVALID_OPERATION:
                return "INVALID_OPERATION";
            case this.gl.INVALID_FRAMEBUFFER_OPERATION:
                return "INVALID_FRAMEBUFFER_OPERATION";
            case this.gl.OUT_OF_MEMORY:
                return "OUT_OF_MEMORY";
            case this.gl.CONTEXT_LOST_WEBGL:
                return "CONTEXT_LOST_WEBGL";
            default:
                return "UNEXPECTED ERROR";
        }
    }

    print(e) {
        console.log(this.string(e))
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

function loadBufferLearn(gl, vertexShader, fragmentShader, program) {
    const squareHeight = 300.0;
    const squareWidth = 760.0;
    // const squareHeight = gl.canvas.height;
    // const squareWidth = gl.canvas.width;
    const cellPositions = new Float32Array([
        0.0, 0.0,
        0.0, squareHeight,
        squareWidth, 0.0,

        squareWidth, 0.0,
        0.0, squareHeight,
        squareWidth, squareHeight,
    ]);

    const battlecruiserImage = new Image();
    battlecruiserImage.src = 'http://localhost:8080/image.png';
    battlecruiserImage.onload = () => {
        // vertex shader set a_position
        gl.useProgram(program);
        const gBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, gBuf);
        gl.bufferData(gl.ARRAY_BUFFER, cellPositions, gl.STATIC_DRAW);

        const a_position_loc = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(a_position_loc);
        gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);

        // a_texCoord
        const texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0,  0.0,
            0.0,  1.0,
            1.0,  0.0,

            1.0,  0.0,
            0.0,  1.0,
            1.0,  1.0,
        ]), gl.STATIC_DRAW);

        const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");
        gl.enableVertexAttribArray(texcoordLocation);
        gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

        // vertex shader set u_resolution
        const u_resolutionLoc = gl.getUniformLocation(program, "u_resolution");
        gl.uniform2fv(u_resolutionLoc, [gl.canvas.width, gl.canvas.height]);

        const u_textureResolutionLoc = gl.getUniformLocation(program, "u_textureResolution");
        gl.uniform2fv(u_textureResolutionLoc, [battlecruiserImage.width, battlecruiserImage.height]);

        const u_textureSizeLoc = gl.getUniformLocation(program, "u_textureSize");
        gl.uniform2fv(u_textureSizeLoc, [battlecruiserImage.width, battlecruiserImage.height]);

        const u_kernelWeightLoc = gl.getUniformLocation(program, "u_kernelWeight");

        // // fragment shader set u_color
        // const u_color_loc = gl.getUniformLocation(program, "u_color");
        // gl.uniform3fv(u_color_loc, [.5, .0, .5]);
        const originalTexture = createAndSetupTexture(gl);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, battlecruiserImage);

        // framebuffer experiments
        const attachments = [
            new Attachment(gl, battlecruiserImage),
            new Attachment(gl, battlecruiserImage),
        ];

        const kernelLoc = gl.getUniformLocation(program, "u_kernel[0]");
        const kernelSet = new KernelSet(gl, kernelLoc, u_kernelWeightLoc);
        const glErrorDeco = new ErrorDeco(gl);

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
            kernelSet.draw('normal');
            console.log('flags', flags.toString(2));
        }
        // gl.clear(gl.COLOR_BUFFER_BIT);
        // gl.drawArrays(gl.TRIANGLES, 0, 6);

        draw(0b1100);
        const delayDraw = (x) => {
            draw(x);
            return new Promise((resolve, reject) => setTimeout(resolve, 2000));
        }

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

(function(){
    const universe = Universe.new();
    const universeWidth = universe.width();
    const universeHeight = universe.height();

    const canvas = document.getElementById("game-of-life-canvas");
    // canvas.height = (CELL_SIZE + 1) * universeHeight + 1;
    // canvas.width = (CELL_SIZE + 1) * universeWidth + 1;
    canvas.height = 676;
    canvas.width = 1200;
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
    return;
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

    const drawGrid = () => {
        fieldGridShaderProgram.setColor(GRID_COLOR_A);
        fieldGridShaderProgram.run();
    };

    const playPauseButton = document.getElementById("play-pause");

    const play = () => {
        playPauseButton.textContent = "⏸";
        renderLoop();
    };

    const pause = () => {
        playPauseButton.textContent = "▶";
        cancelAnimationFrame(animationId);
        animationId = null;
    };

    playPauseButton.addEventListener("click", event => {
        if (isPaused()) {
            play();
        } else {
            pause();
        }
    });

    // const app = new App(universe, gl, CELL_SIZE, DEAD_COLOR, ALIVE_COLOR_A);
    // const gridPositions = app.computeGridPositions();
    // const fieldGridShaderProgram = new GridShaderProgram(
    //     gl, simplePointProgram, gl.LINES, gridPositions, 
    // );


    // This function is the same as before, except the
    // result of `requestAnimationFrame` is assigned to
    // `animationId`.
    const renderLoop = () => {
        fps.render();
        // for (let i = 0; i < 9; i++) {
        universe.tick();
        // }
        drawGrid();
        app.drawCells(cellVertexData, singleCellShaderProgram);
        animationId = requestAnimationFrame(renderLoop);
    };
    play();

    canvas.addEventListener("click", ev => {
        const boundingRect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / boundingRect.width;
        const scaleY = canvas.height / boundingRect.height;

        const canvasLeft = (ev.clientX - boundingRect.left) * scaleX;
        const canvasTop = (ev.clientY - boundingRect.top) * scaleY;

        const row = Math.min(Math.floor(canvasTop / (CELL_SIZE + 1)), universeHeight - 1);
        const col = Math.min(Math.floor(canvasLeft / (CELL_SIZE + 1)), universeWidth - 1);

        if (ev.ctrlKey) {
            universe.spawn_glider(row, col);
        } else {
            universe.toggle_cell(row, col);
        }

        drawGrid();
        app.drawCells(cellVertexData, singleCellShaderProgram);
    });
})();
