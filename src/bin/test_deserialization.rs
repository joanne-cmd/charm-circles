#[cfg(not(target_arch = "wasm32"))]
use charmcircle::{CircleState, PubKey};
#[cfg(not(target_arch = "wasm32"))]
use std::env;

#[cfg(not(target_arch = "wasm32"))]
fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 6 {
        eprintln!("Usage: test_deserialization <circle_id_hex> <contribution_per_round> <round_duration> <created_at_timestamp> <creator_pubkey_hex>");
        eprintln!("Example: test_deserialization $(openssl rand -hex 32) 100000 2592000 $(date +%s) 023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281");
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

    // Serialize using ciborium (same as charms_data and CircleState::state_hash use)
    let mut serialized = Vec::new();
    ciborium::ser::into_writer(&circle_state, &mut serialized)
        .expect("Failed to serialize circle state");

    println!("✓ Serialized {} bytes", serialized.len());
    println!("Serialized hex: {}", hex::encode(&serialized));

    // Now test deserialization
    println!("\nTesting deserialization...");
    match ciborium::de::from_reader::<CircleState, _>(&serialized[..]) {
        Ok(deserialized_state) => {
            println!("✓ Successfully deserialized!");
            println!("  Members: {}", deserialized_state.members.len());
            println!("  Current round: {}", deserialized_state.current_round);
            println!("  Total rounds: {}", deserialized_state.total_rounds);
            println!("  Pool: {}", deserialized_state.current_pool);

            match deserialized_state.validate() {
                Ok(_) => println!("✓ State validation passed!"),
                Err(e) => {
                    println!("✗ State validation failed: {}", e);
                    std::process::exit(1);
                }
            }

            // Verify roundtrip
            if deserialized_state.circle_id == circle_state.circle_id
                && deserialized_state.members.len() == circle_state.members.len()
            {
                println!("✓ Roundtrip test passed!");
            } else {
                println!("✗ Roundtrip test failed - data mismatch");
                std::process::exit(1);
            }
        }
        Err(e) => {
            println!("✗ Deserialization failed: {}", e);
            std::process::exit(1);
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn main() {
    eprintln!("This binary is not available for WASM targets");
    std::process::exit(1);
}
