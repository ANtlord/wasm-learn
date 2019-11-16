export class ErrorDeco {
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

export function createAndSetupTexture(gl) {
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
