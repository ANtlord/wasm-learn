use js_sys::Math;

use crate::entity::Cell;

pub fn default(width: u32, height: u32) -> Vec<Cell> {
    (0..width * height)
        .map(|i| {
            if i % 2 == 0 || i % 7 == 0 {
                Cell::Alive
            } else {
                Cell::Dead
            }
        })
    .collect()
}

///
/// Draws this
/// #--#-
/// ----#
/// #---#
/// -####
/// into one dimension array
/// #--# ---- -##- --#- ####
///
pub fn space_ship(width: u32, height: u32) -> Vec<Cell> {
    let points = [
        0,
        3,
        1 * width + 4,
        2 * width + 0,
        2 * width + 4,
        3 * width + 1,
        3 * width + 2,
        3 * width + 3,
        3 * width + 4,
    ];
    (0..width * height).map(|i| {
        if points.contains(&i) {
            return Cell::Alive;
        }
        return Cell::Dead;
    }).collect()
}

pub fn random(width: u32, height: u32) -> Vec<Cell> {
    (0..width * height).map(|_| {
        if Math::random() < 0.5 {Cell::Alive} else {Cell::Dead}
    }).collect()
}

pub fn glider() -> [bool; 9] {
    [
        false, false, true,
        true, false, true,
        false, true, true,
    ]
}
