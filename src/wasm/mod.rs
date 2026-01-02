// WASM-specific module
// This isolates all WASM/WASI handling code
// Organized similar to how other Charms projects structure their WASM code

// Note: Custom getrandom implementation is now in lib.rs at the top
// to ensure it's properly linked into the WASM module
// WASI polyfill is no longer needed since we use custom getrandom
