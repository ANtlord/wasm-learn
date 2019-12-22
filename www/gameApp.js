export class App {
    constructor(universe, gl, cellSize, deadColor, aliveColor) {
        this.universe = universe;
        this.universeWidth = universe.width();
        this.universeHeight = universe.height();
        this.gl = gl;
        this.cellSize = cellSize;
        this.deadColor = deadColor;
        this.aliveColor = aliveColor
    }

    getIndex(row, column){
        return row * this.universeWidth + column;
    }

    drawCells(cellVertexData, singleCellShaderProgram) {
        const cellsPtr = this.universe.cells();
        const cells = new Uint8Array(memory.buffer, cellsPtr, this.universeWidth * this.universeHeight / 8);
        let count = 0;

        for (let row = 0; row < this.universeHeight; row++) {
            for (let col = 0; col < this.universeWidth; col++) {
                const idx = this.getIndex(row, col);
                if (!bitIsSet(idx, cells)) {
                    continue;
                }
                const startx = col * (this.cellSize + 1) + 1;
                const starty = row * (this.cellSize + 1) + 1;
                // left top triangle
                cellVertexData[count++] = startx;
                cellVertexData[count++] = starty;

                cellVertexData[count++] = startx + this.cellSize;
                cellVertexData[count++] = starty;

                cellVertexData[count++] = startx;
                cellVertexData[count++] = starty + this.cellSize;

                // left botton triangle
                cellVertexData[count++] = startx;
                cellVertexData[count++] = starty + this.cellSize;

                cellVertexData[count++] = startx + this.cellSize;
                cellVertexData[count++] = starty;

                cellVertexData[count++] = startx + this.cellSize;
                cellVertexData[count++] = starty + this.cellSize;
            }
        }
        singleCellShaderProgram.setColor(this.aliveColor);
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
                //    : this.deadColor;

                this.gl.fillRect(
                    col * (this.cellSize + 1) + 1,
                    row * (this.cellSize + 1) + 1,
                    this.cellSize,
                    this.cellSize
                );
            }
        }

        this.gl.fillStyle = this.deadColor;
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const idx = getIndex(row, col);

                // This is updated!
                if (bitIsSet(idx, cells)) {
                    continue;
                }
                //    ? ALIVE_COLOR
                //    : this.deadColor;

                this.gl.fillRect(
                    col * (this.cellSize + 1) + 1,
                    row * (this.cellSize + 1) + 1,
                    this.cellSize,
                    this.cellSize
                );
            }
        }

        this.gl.stroke();
    }

    computeGridPositions() {
        const res = new Float32Array(4 * (this.universeWidth + 1) + 4 * (this.universeHeight + 1));
        let counter = 0;

        for (let i = 0; i <= this.universeWidth; i++) {
            res[counter++] = i * (this.cellSize + 1) + 1;
            res[counter++] = 0;
            res[counter++] = i * (this.cellSize + 1) + 1;
            res[counter++] = (this.cellSize + 1) * this.universeHeight + 1;
        }
        // Horizontal lines.
        for (let j = 0; j <= this.universeHeight; j++) {
            res[counter++] = 0;
            res[counter++] = j * (this.cellSize + 1) + 1;
            res[counter++] = (this.cellSize + 1) * this.universeWidth + 1;
            res[counter++] = j * (this.cellSize + 1) + 1;
        }
        return res;
    }

    getUniverse() {
        return this.universe;
    }
}

export class ClickListener {
    constructor(canvas, cellSize, universe, app, singleCellShaderProgram, cellVertexData, gridDrawer) {
        this.canvas = canvas;
        this.cellSize = cellSize;
        this.singleCellShaderProgram = singleCellShaderProgram;
        this.app = app;
        this.cellVertexData = cellVertexData;
        this.gridDrawer = gridDrawer;
    }

    handle(ev) {
        const universe = this.app.getUniverse();
        const boundingRect = this.canvas.getBoundingClientRect();

        const scaleX = this.canvas.width / boundingRect.width;
        const scaleY = this.canvas.height / boundingRect.height;

        const canvasLeft = (ev.clientX - boundingRect.left) * scaleX;
        const canvasTop = (ev.clientY - boundingRect.top) * scaleY;

        const row = Math.min(Math.floor(canvasTop / (this.cellSize + 1)), universe.height() - 1);
        const col = Math.min(Math.floor(canvasLeft / (this.cellSize + 1)), universe.width() - 1);

        if (ev.ctrlKey) {
            universe.spawn_glider(row, col);
        } else {
            universe.toggle_cell(row, col);
        }

        this.gridDrawer.draw();
        // this.app.drawCells(this.cellVertexData, this.singleCellShaderProgram);
    }
}

export class GridDrawer {
    constructor(fieldGridShaderProgram, gridColor, cellVertexData, singleCellShaderProgram, app) {
        this.fieldGridShaderProgram = fieldGridShaderProgram;
        this.gridColor = gridColor;
        this.cellVertexData = cellVertexData
        this.singleCellShaderProgram = singleCellShaderProgram;
        this.app = app;
    }

    draw() {
        this.fieldGridShaderProgram.setColor(this.gridColor);
        this.fieldGridShaderProgram.run();
        this.app.drawCells(this.cellVertexData, this.singleCellShaderProgram);
    }
}

export class RenderLoop {
    constructor(app, gridDrawer, fps) {
        this.app = app;
        this.gridDrawer = gridDrawer;
        this.fps = fps;
        this.animationId = null;
        this.speed = 1;
    }

    // This function is the same as before, except the
    // result of `requestAnimationFrame` is assigned to
    // `animationId`.
    tick() {
        const universe = this.app.getUniverse()
        this.fps.render();
        for (let i = 0; i < this.speed; i++) {
            universe.tick();
        }
        this.gridDrawer.draw();
        this.animationId = requestAnimationFrame(this.tick);
    }

    pause() {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
    }
}
