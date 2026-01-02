#[cfg(not(target_arch = "wasm32"))]
use charmcircle::{CircleState, PubKey};
#[cfg(not(target_arch = "wasm32"))]
use ciborium;
#[cfg(not(target_arch = "wasm32"))]
use std::env;

#[cfg(not(target_arch = "wasm32"))]
fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: update_state <command> [args...]");
        eprintln!("Commands:");
        eprintln!("  add_member <prev_state_hex> <new_member_pubkey_hex> <payout_round> <joined_at_timestamp>");
        eprintln!("  record_contribution <prev_state_hex> <contributor_pubkey_hex> <amount> <timestamp> <txid_hex>");
        std::process::exit(1);
    }

    let command = &args[1];

    match command.as_str() {
        "add_member" => {
            if args.len() != 6 {
                eprintln!("Usage: update_state add_member <prev_state_hex> <new_member_pubkey_hex> <payout_round> <joined_at_timestamp>");
                std::process::exit(1);
            }

            let prev_state_hex = &args[2];
            let new_member_pubkey_hex = &args[3];
            let payout_round: u32 = args[4].parse().expect("Invalid payout_round");
            let joined_at: u64 = args[5].parse().expect("Invalid joined_at_timestamp");

            // Deserialize previous state
            let prev_state_bytes = hex::decode(prev_state_hex).expect("Invalid hex for prev_state");
            let mut state: CircleState = ciborium::de::from_reader(&prev_state_bytes[..])
                .expect("Failed to deserialize previous state");

            // Parse new member pubkey
            if new_member_pubkey_hex.len() != 66 {
                eprintln!("Error: new_member_pubkey must be 66 hex characters (33 bytes)");
                std::process::exit(1);
            }
            let new_member_pubkey_bytes =
                hex::decode(new_member_pubkey_hex).expect("Invalid hex for new_member_pubkey");
            let new_member_pubkey = PubKey(new_member_pubkey_bytes);

            // Add member
            state
                .add_member(new_member_pubkey, payout_round, joined_at)
                .expect("Failed to add member");

            // Serialize updated state
            let mut serialized = Vec::new();
            ciborium::ser::into_writer(&state, &mut serialized)
                .expect("Failed to serialize updated state");

            let serialized_hex = hex::encode(&serialized);
            println!("{}", serialized_hex);
        }

        "record_contribution" => {
            if args.len() != 7 {
                eprintln!("Usage: update_state record_contribution <prev_state_hex> <contributor_pubkey_hex> <amount> <timestamp> <txid_hex>");
                std::process::exit(1);
            }

            let prev_state_hex = &args[2];
            let contributor_pubkey_hex = &args[3];
            let amount: u64 = args[4].parse().expect("Invalid amount");
            let timestamp: u64 = args[5].parse().expect("Invalid timestamp");
            let txid_hex = &args[6];

            // Deserialize previous state
            let prev_state_bytes = hex::decode(prev_state_hex).expect("Invalid hex for prev_state");
            let mut state: CircleState = ciborium::de::from_reader(&prev_state_bytes[..])
                .expect("Failed to deserialize previous state");

            // Parse contributor pubkey
            if contributor_pubkey_hex.len() != 66 {
                eprintln!("Error: contributor_pubkey must be 66 hex characters (33 bytes)");
                std::process::exit(1);
            }
            let contributor_pubkey_bytes =
                hex::decode(contributor_pubkey_hex).expect("Invalid hex for contributor_pubkey");
            let contributor_pubkey = PubKey(contributor_pubkey_bytes);

            // Parse txid
            if txid_hex.len() != 64 {
                eprintln!("Error: txid must be 64 hex characters (32 bytes)");
                std::process::exit(1);
            }
            let txid_bytes = hex::decode(txid_hex).expect("Invalid hex for txid");
            let mut txid = [0u8; 32];
            txid.copy_from_slice(&txid_bytes);

            // Record contribution
            state
                .record_contribution(&contributor_pubkey, amount, timestamp, txid)
                .expect("Failed to record contribution");

            // Serialize updated state
            let mut serialized = Vec::new();
            ciborium::ser::into_writer(&state, &mut serialized)
                .expect("Failed to serialize updated state");

            let serialized_hex = hex::encode(&serialized);
            println!("{}", serialized_hex);
        }

        _ => {
            eprintln!("Unknown command: {}", command);
            std::process::exit(1);
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn main() {
    eprintln!("This binary is not available for WASM targets");
    std::process::exit(1);
}
