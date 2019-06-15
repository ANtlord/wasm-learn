import * as wasm from "wasm-game-of-life";
import { Universe, Cell } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#FF0000";
const DEAD_COLOR = "#00FF00";
const ALIVE_COLOR = "#FF0000";

const universe = Universe.new();
const width = universe.width();
const height = universe.height();

const canvas = document.getElementById("game-of-life-canvas");
canvas.height = (CELL_SIZE + 1) * height + 1;
canvas.width = (CELL_SIZE + 1) * width + 1;

const ctx = canvas.getContext('2d');

const getIndex = (row, column) => {
    return row * width + column;
};

const flags_in_item = 32;

const slot_index = (index) => {
    const len = width * height;
    const slot_index = Math.floor((len - index - 1) / flags_in_item);
    return slot_index;
}

const shift = (index) => {
    return index % flags_in_item;
}

const isBitUp = (maskArr, index) => {
    const res = maskArr[slot_index(index)] >> shift(index) & 1 == 1;
    return res;
}

const drawCells = () => {
    const cellsPtr = universe.cells();
    const cells = new Uint32Array(memory.buffer, cellsPtr, width * height / flags_in_item + 1);
    ctx.beginPath();
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const idx = getIndex(row, col);
            ctx.fillStyle = isBitUp(cells, idx)
                ? ALIVE_COLOR
                : DEAD_COLOR;
            ctx.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }
    ctx.stroke();
};

const drawGrid = () => {
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR;
    // Vertical lines.
    for (let i = 0; i <= width; i++) {
        ctx.moveTo(i * (CELL_SIZE + 1) + 1, 0);
        ctx.lineTo(i * (CELL_SIZE + 1) + 1, (CELL_SIZE + 1) * height + 1);
    }
    // Horizontal lines.
    for (let j = 0; j <= height; j++) {
        ctx.moveTo(0,
            j * (CELL_SIZE + 1) + 1);
        ctx.lineTo((CELL_SIZE + 1) * width + 1, j * (CELL_SIZE + 1) + 1);
    }
    ctx.stroke();
};

const renderLoop = () => {
    universe.tick();
    drawGrid();
    drawCells();
    requestAnimationFrame(renderLoop);
};

requestAnimationFrame(renderLoop);
