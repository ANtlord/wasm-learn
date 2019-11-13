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
            res[counter++] = norm(i * (this.cellSize + 1) + 1);
            res[counter++] = norm(0);
            res[counter++] = norm(i * (this.cellSize + 1) + 1);
            res[counter++] = norm((this.cellSize + 1) * this.universeHeight + 1);
        }
        // Horizontal lines.
        for (let j = 0; j <= this.universeHeight; j++) {
            res[counter++] = norm(0);
            res[counter++] = norm(j * (this.cellSize + 1) + 1);
            res[counter++] = norm((this.cellSize + 1) * this.universeWidth + 1);
            res[counter++] = norm(j * (this.cellSize + 1) + 1);
        }
        return res;
    }
}
