import * as wasm from "wasm-game-of-life";
import { Universe, Cell } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#434C5E";
const GRID_COLOR_A = new Float32Array([0.2627, 0.298, 0.368]);
const DEAD_COLOR = "#434C5E";
const ALIVE_COLOR = "#CCCCFF";
const ALIVE_COLOR_A = new Float32Array([0.8, 0.8, 1]);

const universe = Universe.new();
const width = universe.width();
const height = universe.height();

const canvas = document.getElementById("game-of-life-canvas");
canvas.height = (CELL_SIZE + 1) * height + 1;
canvas.width = (CELL_SIZE + 1) * width + 1;

const gl = canvas.getContext('webgl', {
    antialias: true,
});
if (!gl) {
    alert('WebGL not working');
}
gl.lineWidth(1)

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }


    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}


const vertexShaderSource = document.getElementById("2d-vertex-shader").text;
const fragmentShaderSource = document.getElementById("2d-fragment-shader").text;
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const simplePointProgram = createProgram(gl, vertexShader, fragmentShader);


class GridShaderProgram {
    constructor(gl, program, primitiveType, positions) {
        this.gl = gl;
        this.program = program;
        this.bufferElementsPerIteration = 2;

        this.positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.resolutionUniformLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.colorUniformLocation = this.gl.getUniformLocation(this.program, "u_color");

        this.positionBuffer = gl.createBuffer();
        this.primitiveType = primitiveType;

        // can be dynamic.
        this.updatePositions(positions);
    }

    setColor(color) {
        this.gl.useProgram(this.program);
        this.gl.uniform3fv(this.colorUniformLocation, color);
    }

    /**
     * Call to set new positions for vertex shader data.
     */
    updatePositions(positions) {
        this.positions = positions;
        this.loadVideoDataBuffer();
    }

    run() {
        this.setPointerReadFrom();
        this.setReadingFashion();
        this.draw();
    }

    draw() {
        const offset = 0;
        const count = this.positions.length / this.bufferElementsPerIteration;
        this.gl.drawArrays(this.primitiveType, offset, count);
    }
    
    loadVideoDataBuffer() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.positions, this.gl.STATIC_DRAW);
    }

    setPointerReadFrom() {
        this.gl.useProgram(this.program);
        this.gl.enableVertexAttribArray(this.positionAttributeLocation);
        this.gl.uniform2f(this.resolutionUniformLocation, this.gl.canvas.width, this.gl.canvas.height);
    }

    setReadingFashion() {
        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        const size = this.bufferElementsPerIteration;  // 2 components per iteration
        const type = this.gl.FLOAT;   // the data is 32bit floats
        const normalize = false; // don't normalize the data
        const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        const offset = 0;        // start at the beginning of the buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(
            this.positionAttributeLocation, size, type, normalize, stride, offset,
        );
    }
}

const norm = (x) => {
    // const val = canvas.width / 2;
    // return (x - val) / val;
    return x;
}

const computeGridPositions = () => {
    const res = new Float32Array(4 * (width + 1) + 4 * (height + 1));
    let counter = 0;

    for (let i = 0; i <= width; i++) {
        res[counter++] = norm(i * (CELL_SIZE + 1) + 1);
        res[counter++] = norm(0);
        res[counter++] = norm(i * (CELL_SIZE + 1) + 1);
        res[counter++] = norm((CELL_SIZE + 1) * height + 1);
    }
    // Horizontal lines.
    for (let j = 0; j <= height; j++) {
        res[counter++] = norm(0);
        res[counter++] = norm(j * (CELL_SIZE + 1) + 1);
        res[counter++] = norm((CELL_SIZE + 1) * width + 1);
        res[counter++] = norm(j * (CELL_SIZE + 1) + 1);
    }
    return res;
}

const gridPositions = computeGridPositions();
const fieldGridShaderProgram = new GridShaderProgram(
    gl, simplePointProgram, gl.LINES, gridPositions, 
);
const cellPositions = new Float32Array([
    0.0, 0.0,
    0.0, 100.0,
    100.0, 0.0,

    100.0, 0.0,
    0.0, 100.0,
    100.0, 100.0,
]);
const singleCellShaderProgram = new GridShaderProgram(gl, simplePointProgram, gl.TRIANGLES, cellPositions);

gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clearColor(0,0,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

const getIndex = (row, column) => {
    return row * width + column;
};

const bitIsSet = (n, arr) => {
    const byte = Math.floor(n / 8);
    const mask = 1 << (n % 8);
    return (arr[byte] & mask) === mask;
};

const cellVertexData = new Float32Array(12 * width * height);

const drawCells = () => {
    const cellsPtr = universe.cells();
    const cells = new Uint8Array(memory.buffer, cellsPtr, width * height / 8);
    let count = 0;

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const idx = getIndex(row, col);
            if (!bitIsSet(idx, cells)) {
                continue;
            }
            const startx = col * (CELL_SIZE + 1) + 1;
            const starty = row * (CELL_SIZE + 1) + 1;
            // left top triangle
            cellVertexData[count++] = startx;
            cellVertexData[count++] = starty;

            cellVertexData[count++] = startx + CELL_SIZE;
            cellVertexData[count++] = starty;

            cellVertexData[count++] = startx;
            cellVertexData[count++] = starty + CELL_SIZE;

            // left botton triangle
            cellVertexData[count++] = startx;
            cellVertexData[count++] = starty + CELL_SIZE;

            cellVertexData[count++] = startx + CELL_SIZE;
            cellVertexData[count++] = starty;

            cellVertexData[count++] = startx + CELL_SIZE;
            cellVertexData[count++] = starty + CELL_SIZE;
        }
    }
    singleCellShaderProgram.setColor(ALIVE_COLOR_A);
    singleCellShaderProgram.updatePositions(cellVertexData.slice(0, count));
    singleCellShaderProgram.run();
    return;

    // This is updated!

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const idx = getIndex(row, col);

            // This is updated!
            if (!bitIsSet(idx, cells)) {
                continue;
            }
            //    ? ALIVE_COLOR
            //    : DEAD_COLOR;

            gl.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    gl.fillStyle = DEAD_COLOR;
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const idx = getIndex(row, col);

            // This is updated!
            if (bitIsSet(idx, cells)) {
                continue;
            }
            //    ? ALIVE_COLOR
            //    : DEAD_COLOR;

            gl.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    gl.stroke();
};


const drawGrid = () => {
    fieldGridShaderProgram.setColor(GRID_COLOR_A);
    fieldGridShaderProgram.run();
};

const fps = new class {
    constructor() {
        this.fps = document.getElementById("fps");
        this.frames = [];
        this.lastFrameTimeStamp = performance.now();
    }

    render() {
        // Convert the delta time since the last frame render into a measure
        // of frames per second.
        const now = performance.now();
        const delta = now - this.lastFrameTimeStamp;
        this.lastFrameTimeStamp = now;
        const fps = 1 / delta * 1000;

        // Save only the latest 100 timings.
        this.frames.push(fps);
        if (this.frames.length > 100) {
            this.frames.shift();
        }

        // Find the max, min, and mean of our 100 latest timings.
        let min = Infinity;
        let max = -Infinity;
        let sum = 0;
        for (let i = 0; i < this.frames.length; i++) {
            sum += this.frames[i];
            min = Math.min(this.frames[i], min);
            max = Math.max(this.frames[i], max);
        }
        let mean = sum / this.frames.length;

        // Render the statistics.
        this.fps.textContent = `
Frames per Second:
latest = ${Math.round(fps)}
avg of last 100 = ${Math.round(mean)}
min of last 100 = ${Math.round(min)}
max of last 100 = ${Math.round(max)}
        `.trim();
    }
};
let animationId = null;

const isPaused = () => {
    return animationId === null;
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

// This function is the same as before, except the
// result of `requestAnimationFrame` is assigned to
// `animationId`.
const renderLoop = () => {
    fps.render();
    // for (let i = 0; i < 9; i++) {
    universe.tick();
    // }
    drawGrid();
    drawCells();
    animationId = requestAnimationFrame(renderLoop);
};
play();

canvas.addEventListener("click", ev => {
    const boundingRect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / boundingRect.width;
    const scaleY = canvas.height / boundingRect.height;

    const canvasLeft = (ev.clientX - boundingRect.left) * scaleX;
    const canvasTop = (ev.clientY - boundingRect.top) * scaleY;

    const row = Math.min(Math.floor(canvasTop / (CELL_SIZE + 1)), height - 1);
    const col = Math.min(Math.floor(canvasLeft / (CELL_SIZE + 1)), width - 1);

    if (ev.ctrlKey) {
        universe.spawn_glider(row, col);
    } else {
        universe.toggle_cell(row, col);
    }

    drawGrid();
    drawCells();
});
