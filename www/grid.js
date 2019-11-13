export class GridShaderProgram {
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
