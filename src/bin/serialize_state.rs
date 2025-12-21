#[cfg(not(target_arch = "wasm32"))]
use charmcircle::{CircleState, PubKey};
#[cfg(not(target_arch = "wasm32"))]
use serde_cbor;
#[cfg(not(target_arch = "wasm32"))]
use std::env;

#[cfg(not(target_arch = "wasm32"))]
fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 6 {
        eprintln!("Usage: serialize_state <circle_id_hex> <contribution_per_round> <round_duration> <created_at_timestamp> <creator_pubkey_hex>");
        eprintln!("Example: serialize_state $(openssl rand -hex 32) 100000 2592000 $(date +%s) 023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281");
        std::process::exit(1);
    }

    // Parse circle_id (64 hex chars = 32 bytes)
    let circle_id_hex = &args[1];
    if circle_id_hex.len() != 64 {
        eprintln!("Error: circle_id must be 64 hex characters (32 bytes)");
        std::process::exit(1);
    }
    let circle_id = hex::decode(circle_id_hex).expect("Invalid hex for circle_id");
    let mut circle_id_bytes = [0u8; 32];
    circle_id_bytes.copy_from_slice(&circle_id);

    // Parse contribution_per_round (satoshis)
    let contribution_per_round: u64 = args[2].parse().expect("Invalid contribution_per_round");

    // Parse round_duration (seconds)
    let round_duration: u64 = args[3].parse().expect("Invalid round_duration");

    // Parse created_at timestamp
    let created_at: u64 = args[4].parse().expect("Invalid created_at timestamp");

    // Parse creator pubkey (66 hex chars = 33 bytes)
    let creator_pubkey_hex = &args[5];
    if creator_pubkey_hex.len() != 66 {
        eprintln!("Error: creator_pubkey must be 66 hex characters (33 bytes)");
        std::process::exit(1);
    }
    let creator_pubkey_bytes =
        hex::decode(creator_pubkey_hex).expect("Invalid hex for creator_pubkey");
    let creator_pubkey = PubKey(creator_pubkey_bytes);

    // Create circle state
    let mut circle_state = CircleState::new(
        circle_id_bytes,
        contribution_per_round,
        round_duration,
        created_at,
    );

    // Add creator as first member (payout_round 0)
    circle_state
        .add_member(creator_pubkey, 0, created_at)
        .expect("Failed to add creator as member");

    // Serialize using CBOR (same as charms_data uses)
    let serialized = serde_cbor::to_vec(&circle_state).expect("Failed to serialize circle state");

    // Output as hex string
    let serialized_hex = hex::encode(&serialized);
    println!("{}", serialized_hex);
}

#[cfg(target_arch = "wasm32")]
fn main() {
    eprintln!("This binary is not available for WASM targets");
    std::process::exit(1);
}
