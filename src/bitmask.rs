use std::mem::size_of;

#[derive(Clone)]
pub struct Bitmask {
    pub len: usize,
    pub data: Vec<u32>,
}

const flags_in_item: usize = size_of::<u32>() * 8;

impl Bitmask {
    pub fn new(vals: &[bool]) -> Self {
        let mut len = 0;
        let mut data: Vec<u32> = vec![0u32; vals.len() / flags_in_item + 1];
        for flag in vals.iter().rev() {
            let data_index = len / flags_in_item;
            data[data_index] <<= 1;
            if *flag {
                data[data_index] |= 1;
            }
            len += 1;
        }
        Self{len, data}
    }

    #[inline]
    fn shift(&self, index: usize) -> usize {
        index % flags_in_item
    }

    #[inline]
    fn slot_index(&self, index: usize) -> usize {
        let slot_index = (self.len - index - 1) / flags_in_item;
        slot_index
    }

    pub fn at(&self, index: usize) -> bool {
        self.data[self.slot_index(index)] >> self.shift(index) & 1 == 1
    }

    pub fn set(&mut self, index: usize, value: bool) {
        let slot = self.slot_index(index);
        self.data[slot] = self.data[slot] | 1 << self.shift(index);
        if !value {
            self.data[slot] = self.data[slot] & !(1 << self.shift(index));
        }
        dbg!(format!("{:b}", self.data[slot]));
    }

    pub fn as_slice(&self) -> &[u32] {
        self.data.as_slice()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bitmask_new_one_element() {
        let mut flags = [false; 32];
        flags[2] = true;
        flags[4] = true;
        // let m = Bitmask::new(&[false, false, true, false, true]);
        let m = Bitmask::new(&flags);
        assert_eq!(m.len, 32);
        assert_eq!(m.data.len(), 2);
        assert_eq!(m.data[0], 0b0001_0100, "data is {:b}", m.data[0]);
        // assert_eq!(m.data[0], 4);
    }

    #[test]
    fn test_bitmask_new_two_elements() {
        let mut flags = [false; 64];

        flags[3] = true;
        flags[6] = true;
        flags[7] = true;

        flags[32] = true;
        flags[36] = true;

        let m = Bitmask::new(&flags);
        assert_eq!(m.data[0], 0b0001_0001, "data is {:b}", m.data[0]);
        assert_eq!(m.data[1], 0b1100_1000, "data is {:b}", m.data[0]);
        assert_eq!(m.len, 64);
    }

    #[test]
    fn test_bitmask_at_one_element() {
        let m = Bitmask::new(&[true, false, false]);
        assert_eq!(m.at(0), true);
        assert_eq!(m.at(1), false);
        assert_eq!(m.at(2), false);
    }

    #[test]
    fn test_bitmask_at_two_elements() {
        let mut flags = [false; 64];

        flags[3] = true;
        flags[6] = true;
        flags[7] = true;

        flags[32] = true;
        flags[36] = true;

        let m = Bitmask::new(&flags);
        assert_eq!(m.at(3), true);
        assert_eq!(m.at(6), true);
        assert_eq!(m.at(7), true);
        assert_eq!(m.at(32), true);
        assert_eq!(m.at(36), true);
    }


    // #[test]
    // fn test_shift() {
    //    let a = 0u8;
    //    
    //    assert_eq!(a | !(1 << 3), 0b1111_0111);
    // }

    #[test]
    fn test_bitmask_set_one_element() {
        let mut m = Bitmask::new(&[true, false, false]);
        m.set(0, false);
        assert_eq!(m.at(0), false);
        m.set(1, true);
        assert_eq!(m.at(1), true);

        m.set(2, true);
        assert_eq!(m.at(2), true, "data is {:b}", m.data[0]);
        m.set(2, false);
        assert_eq!(m.at(2), false);

        assert_eq!(m.data[0], 0b0000_0010);
    }

    #[test]
    fn test_bitmask_set_two_elements() {
        let mut flags = [false; 64];

        flags[3] = true;
        flags[6] = true;
        flags[7] = true;

        flags[32] = true;
        flags[36] = true;

        let mut m = Bitmask::new(&flags);

        m.set(0, false);
        assert_eq!(m.at(0), false);
        m.set(1, true);
        assert_eq!(m.at(1), true);

        m.set(2, true);
        assert_eq!(m.at(2), true, "data is {:b}", m.data[1]);
        m.set(2, false);
        assert_eq!(m.at(2), false);

        m.set(36, false);
        assert_eq!(m.at(36), false, "data is {:b}", m.data[0]);
        m.set(32, true);
        assert_eq!(m.at(32), true);
        m.set(32, false);
        assert_eq!(m.at(32), false);

    }

    #[test]
    fn test_as_slice() {
        let m = Bitmask::new(&[true, false, false, true]);
        assert_eq!(m.as_slice(), [9]);
    }

}
