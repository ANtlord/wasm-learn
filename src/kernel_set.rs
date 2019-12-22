use std::ptr;
use wasm_bindgen::prelude::*;

macro_rules! error {
    ( $( $t:tt )* ) => {
        web_sys::console::error_1(&format!( $( $t )* ).into());
    }
}

#[wasm_bindgen(js_namespace = qwe)]
pub struct KernelSet {
    gl: web_sys::WebGlRenderingContext,
    kernel_location: web_sys::WebGlUniformLocation,
    kernel_weight_location: web_sys::WebGlUniformLocation,
    kernels: [[f32; 9]; 4],
    names: [String; 4],
}

#[wasm_bindgen(js_namespace = qwe)]
impl KernelSet {
    pub fn new(
        gl: web_sys::WebGlRenderingContext,
        kernel_location: web_sys::WebGlUniformLocation,
        kernel_weight_location: web_sys::WebGlUniformLocation,
    ) -> Self {
        let kernels = [
            [
                0., 0., 0.,
                0., 1., 0.,
                0., 0., 0.
            ],
            [
                0.045, 0.122, 0.045,
                0.122, 0.332, 0.122,
                0.045, 0.122, 0.045
            ],
            [
                -1., -1., -1.,
                -1.,  9., -1.,
                -1., -1., -1.
            ],
            [
                -2., -1.,  0.,
                -1.,  1.,  1.,
                0.,  1.,  2.
            ]
        ];
        let names = [
            "normal".to_owned(),
            "gaussianBlur".to_owned(),
            "unsharpen".to_owned(),
            "emboss".to_owned(),
        ];
        Self {gl, kernel_location, kernel_weight_location, kernels, names}
    }
    
    pub fn get(&self, name: &str) -> *const f32 {
        self.names.iter().position(|x| x == name).map(|x| self.kernels[x].as_ptr()).unwrap_or(ptr::null())
    }

    pub fn len(&self) -> usize {
        self.kernels.len()
    }

    pub fn draw(&self, index: usize, count: i32) {
        if index >= self.kernels.len() {
            error!("unable to get kernel {}", index);
            return;
        }

        let kernel = self.kernels[index];
        self.gl.uniform1fv_with_f32_array(Some(&self.kernel_location), &kernel);
        let kernel_weight = self.kernels[index].iter().sum();
        self.gl.uniform1f(
            Some(&self.kernel_weight_location),
            if kernel_weight <= 0.0 { 1.0 } else { kernel_weight },
        );
        self.gl.draw_arrays(web_sys::WebGlRenderingContext::TRIANGLES, 0, count);
    }
}
