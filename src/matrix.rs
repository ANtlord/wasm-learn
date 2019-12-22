use std::ops::Deref;
use wasm_bindgen::prelude::*;
use std::slice;

#[wasm_bindgen]
pub struct Mat3 {
    data: [f32; 9],
}

fn mul(e: (&f32, &f32)) -> f32 {
    e.0 * e.1
}

impl Mat3 {
    pub fn new(data: [f32; 9]) -> Self {
        return Mat3{data}
    }
}

#[wasm_bindgen]
impl Mat3 {
    pub fn from_raw(ptr: *const f32) -> Self {
        let mut data = [0f32; 9];
        data.clone_from_slice(unsafe {slice::from_raw_parts(ptr, 9)});
        Self{ data }
    }
    pub fn identity() -> Self {
        Self::new([
            1., 0., 0.,
            0., 1., 0.,
            0., 0., 1.,
        ])
    }

    pub fn scaling(sx: f32, sy: f32) -> Self {
        Self::new([
            sx, 0., 0.,
            0., sy, 0.,
            0., 0., 1.,
        ])
    }

    pub fn translation(tx: f32, ty: f32) -> Self {
        Self::new([
            1., 0., 0.,
            0., 1., 0.,
            tx, ty, 1.,
        ])
    }

    pub fn rotation(angle_in_radians: f32) -> Self {
        let c = angle_in_radians.cos();
        let s = angle_in_radians.sin();
        Self::new([
            c, -s, 0.,
            s, c, 0.,
            0., 0., 1.,
        ])
    }

    pub fn dot(&self, d: &Mat3) -> Self {
        let d = d.data;
        let ref origin = self.data;
        let mut m = self.data.clone();
        let row_len = 3;
        for i in 0 .. 9 {
            let origin_row_bounds = (
                i / row_len * row_len,
                i / row_len * row_len + row_len,
            );
            let origin_iter = origin[origin_row_bounds.0 .. origin_row_bounds.1].iter();
            let diter = d[i % row_len .. 9].iter().step_by(row_len);
            m[i] = origin_iter.zip(diter).map(mul).sum::<f32>();
        }
        Self{data: m}
    }

    pub fn scale(&self, sx: f32, sy: f32) -> Self {
        self.dot(&Self::scaling(sx, sy))
    }

    pub fn translate(&self, tx: f32, ty: f32) -> Self {
        self.dot(&Self::translation(tx, ty))
    }

    pub fn rotate(&self, angle_in_radians: f32) -> Self {
        self.dot(&Self::rotation(angle_in_radians))
    }
}

impl Deref for Mat3 {
    type Target = [f32; 9];

    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new() {
        let data = [1., 2., 3., 4., 5., 6., 7., 8., 9.];
        let m = Mat3::new(data);
        assert_eq!(m.data, [1., 2., 3., 4., 5., 6., 7., 8., 9.]);
    }

    #[test]
    fn test_dot() {
        let data = [1., 2., 3., 4., 5., 6., 7., 8., 9.];
        let r = Mat3::new(data).dot(&Mat3::new([1., 2., 3., 4., 5., 6., 7., 8., 9.]));
        assert_eq!(*r, [30.0, 36.0, 42.0, 66.0, 81.0, 96.0, 102.0, 126.0, 150.0]);
        // assert_eq!(0 % 3, 0);
        // assert_eq!(1 % 3, 1);
        // assert_eq!(2 % 3, 2);
        // assert_eq!(3 % 3, 0);

        // assert_eq!(0 / 3, 0);
        // assert_eq!(1 / 3, 0);
        // assert_eq!(2 / 3, 0);
        // assert_eq!(3 / 3, 1);
    }

}
