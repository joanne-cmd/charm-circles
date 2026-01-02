// WASM modules are automatically initialized when lib.rs loads them
// The wasm module in lib.rs ensures getrandom and WASI polyfill are registered

charms_sdk::main!(charmcircle::app_contract);
