pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

pub fn min<T: Ord>(left: T, right: T) -> T {
    if left < right { left } else { right }
}

pub fn max<T: Ord>(left: T, right: T) -> T {
    if left > right { left } else { right }
}
