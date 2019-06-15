use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
}

impl Cell {
    pub fn to_bool(&self) -> bool {
        match self {
            Cell::Alive => true,
            Cell::Dead => false,
        }
    }
}
