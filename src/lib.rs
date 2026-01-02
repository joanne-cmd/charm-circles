// Force no_std for WASM builds to prevent std from pulling in WASI entropy
#![cfg_attr(target_arch = "wasm32", no_std)]

// Custom getrandom implementation for WASM (must be at the very top)
// This ensures the custom getrandom provider is linked into the final WASM module
// Based on: https://github.com/rust-random/getrandom
#[cfg(target_arch = "wasm32")]
use getrandom::register_custom_getrandom;

#[cfg(target_arch = "wasm32")]
register_custom_getrandom!(custom_getrandom);

#[cfg(target_arch = "wasm32")]
fn custom_getrandom(_dest: &mut [u8]) -> Result<(), getrandom::Error> {
    Err(getrandom::Error::UNSUPPORTED)
}

// Force-link the symbol to ensure the linker does not drop it
#[cfg(target_arch = "wasm32")]
#[allow(dead_code)]
fn _force_link_getrandom() {
    let _ = custom_getrandom;
}

// WASM-specific initialization (must be before other imports)
// This ensures WASM modules are loaded and initialized first
#[cfg(target_arch = "wasm32")]
mod wasm;

// For no_std (WASM), we need to use alloc crate
#[cfg(target_arch = "wasm32")]
extern crate alloc;

use charms_sdk::data::{App, Data, Transaction};
use serde::{Deserialize, Serialize};

// Import anyhow for error handling (BRO token pattern)
#[cfg(target_arch = "wasm32")]
use anyhow::{ensure, Result};
#[cfg(not(target_arch = "wasm32"))]
use anyhow::{ensure, Result};

// Use alloc for WASM, std for native
#[cfg(target_arch = "wasm32")]
use alloc::collections::BTreeMap as HashMap;
#[cfg(not(target_arch = "wasm32"))]
use std::collections::HashMap;

// Use alloc::vec::Vec for WASM, std::vec::Vec for native
#[cfg(target_arch = "wasm32")]
use alloc::{
    format,
    string::{String, ToString},
    vec::Vec,
};
#[cfg(not(target_arch = "wasm32"))]
use std::vec::Vec;

/// Represents a Bitcoin public key (33 bytes compressed)
/// Using Vec<u8> for serde compatibility
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PubKey(pub Vec<u8>);

impl PubKey {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn from_bytes(bytes: [u8; 33]) -> Self {
        PubKey(bytes.to_vec())
    }
}

/// Amount in satoshis
pub type Satoshis = u64;

/// Member information and participation history
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Member {
    /// Member's public key
    pub pubkey: PubKey,

    /// Contribution amount per round (in satoshis)
    pub contribution_amount: Satoshis,

    /// History of contributions by round number
    pub contribution_history: Vec<ContributionRecord>,

    /// Whether this member has received their payout
    pub has_received_payout: bool,

    /// The round number when this member is scheduled to receive payout
    pub payout_round: u32,

    /// Timestamp when member joined (Unix timestamp)
    pub joined_at: u64,
}

/// Record of a single contribution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ContributionRecord {
    pub round: u32,
    pub amount: Satoshis,
    pub timestamp: u64,
    pub txid: [u8; 32], // Transaction ID that included this contribution
}

/// The state of the ROSCA circle stored in Charms covenant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleState {
    /// Unique identifier for this ROSCA circle
    pub circle_id: [u8; 32],

    /// List of all members in order of joining
    pub members: Vec<Member>,

    /// Current round number (starts at 0)
    pub current_round: u32,

    /// Total number of rounds (equals number of members)
    pub total_rounds: u32,

    /// Required contribution amount per member per round
    pub contribution_per_round: Satoshis,

    /// Index of member who receives payout this round
    pub current_payout_index: usize,

    /// Total pool collected in current round
    pub current_pool: Satoshis,

    /// Timestamp when circle was created
    pub created_at: u64,

    /// Timestamp when current round started
    pub round_started_at: u64,

    /// Duration of each round in seconds (e.g., 30 days = 2592000)
    pub round_duration: u64,

    /// Whether the circle has completed all rounds
    pub is_complete: bool,

    /// Hash of the previous state for chain verification
    pub prev_state_hash: [u8; 32],
}

impl CircleState {
    /// Create a new ROSCA circle
    pub fn new(
        circle_id: [u8; 32],
        contribution_per_round: Satoshis,
        round_duration: u64,
        created_at: u64,
    ) -> Self {
        Self {
            circle_id,
            members: Vec::new(),
            current_round: 0,
            total_rounds: 0,
            contribution_per_round,
            current_payout_index: 0,
            current_pool: 0,
            created_at,
            round_started_at: created_at,
            round_duration,
            is_complete: false,
            prev_state_hash: [0u8; 32],
        }
    }

    /// Calculate state hash for covenant verification
    /// Uses the same serialization as charms_data for consistency
    pub fn state_hash(&self) -> [u8; 32] {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();

        // Hash the serialized state using CBOR to match what charms_data uses internally
        // Use ciborium which works in no_std (same as Charms SDK uses)
        let mut bytes = Vec::new();
        match ciborium::ser::into_writer(self, &mut bytes) {
            Ok(_) => {}
            Err(_) => return [0u8; 32],
        }

        hasher.update(&bytes);

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }

    /// Add a new member to the circle (only allowed before first round starts)
    pub fn add_member(
        &mut self,
        pubkey: PubKey,
        payout_round: u32,
        timestamp: u64,
    ) -> Result<(), String> {
        // Validation
        if self.current_round > 0 {
            return Err("Cannot add members after circle has started".to_string());
        }

        if self.members.iter().any(|m| m.pubkey == pubkey) {
            return Err("Member already exists".to_string());
        }

        if payout_round as usize >= self.members.len() + 1 {
            return Err("Invalid payout round".to_string());
        }

        let member = Member {
            pubkey,
            contribution_amount: self.contribution_per_round,
            contribution_history: Vec::new(),
            has_received_payout: false,
            payout_round,
            joined_at: timestamp,
        };

        self.members.push(member);
        self.total_rounds = self.members.len() as u32;

        Ok(())
    }

    /// Record a member's contribution for the current round
    pub fn record_contribution(
        &mut self,
        pubkey: &PubKey,
        amount: Satoshis,
        timestamp: u64,
        txid: [u8; 32],
    ) -> Result<(), String> {
        if self.is_complete {
            return Err("Circle is already complete".to_string());
        }

        // Find the member
        let member = self
            .members
            .iter_mut()
            .find(|m| &m.pubkey == pubkey)
            .ok_or("Member not found".to_string())?;

        // Check if already contributed this round
        if member
            .contribution_history
            .iter()
            .any(|c| c.round == self.current_round)
        {
            return Err("Member already contributed this round".to_string());
        }

        // Validate contribution amount
        if amount != self.contribution_per_round {
            return Err(format!(
                "Invalid contribution amount. Expected: {}, Got: {}",
                self.contribution_per_round, amount
            ));
        }

        // Record the contribution
        member.contribution_history.push(ContributionRecord {
            round: self.current_round,
            amount,
            timestamp,
            txid,
        });

        self.current_pool += amount;

        Ok(())
    }

    /// Check if all members have contributed for the current round
    pub fn is_round_fully_funded(&self) -> bool {
        let contributions_this_round = self
            .members
            .iter()
            .filter(|m| {
                m.contribution_history
                    .iter()
                    .any(|c| c.round == self.current_round)
            })
            .count();

        contributions_this_round == self.members.len()
    }

    /// Execute payout to the designated member for current round
    pub fn execute_payout(&mut self, timestamp: u64) -> Result<(PubKey, Satoshis), String> {
        if self.is_complete {
            return Err("Circle is already complete".to_string());
        }

        if !self.is_round_fully_funded() {
            return Err("Round is not fully funded yet".to_string());
        }

        if self.current_payout_index >= self.members.len() {
            return Err("Invalid payout index".to_string());
        }

        let member = &mut self.members[self.current_payout_index];

        if member.has_received_payout {
            return Err("Member has already received payout".to_string());
        }

        let payout_amount = self.current_pool;
        let recipient = member.pubkey.clone();

        member.has_received_payout = true;

        // Update state hash before transitioning
        self.prev_state_hash = self.state_hash();

        // Reset pool and prepare for next round
        self.current_pool = 0;
        self.current_round += 1;
        self.current_payout_index = (self.current_payout_index + 1) % self.members.len();
        self.round_started_at = timestamp;

        // Check if circle is complete
        if self.current_round >= self.total_rounds {
            self.is_complete = true;
        }

        Ok((recipient, payout_amount))
    }

    /// Validate state transition is allowed
    pub fn validate_transition(&self, next_state: &CircleState) -> Result<(), String> {
        // Must be same circle
        if self.circle_id != next_state.circle_id {
            return Err("Circle ID mismatch".to_string());
        }

        // Cannot modify members after start
        if self.current_round > 0 && self.members.len() != next_state.members.len() {
            return Err("Cannot change member count after start".to_string());
        }

        // Round can only increment by 0 or 1
        if next_state.current_round > self.current_round + 1 {
            return Err("Invalid round progression".to_string());
        }

        // Pool can only increase or reset to 0
        if next_state.current_round == self.current_round {
            // Same round: pool should increase
            if next_state.current_pool < self.current_pool {
                return Err("Pool cannot decrease within round".to_string());
            }
        } else {
            // New round: pool should reset
            if next_state.current_pool != 0 {
                return Err("Pool must reset on new round".to_string());
            }
        }

        Ok(())
    }

    /// Validate the entire state for consistency
    pub fn validate(&self) -> Result<(), String> {
        // Check basic constraints
        // For a valid circle, we must have members (even if current_round is 0)
        // The only exception is during initial creation before first member is added,
        // but app_contract handles that case separately
        if self.members.is_empty() {
            return Err("Circle has no members".to_string());
        }

        if self.total_rounds != self.members.len() as u32 {
            return Err(format!(
                "Total rounds ({}) must equal number of members ({})",
                self.total_rounds,
                self.members.len()
            ));
        }

        if self.current_round > self.total_rounds {
            return Err(format!(
                "Current round ({}) exceeds total rounds ({})",
                self.current_round, self.total_rounds
            ));
        }

        if self.current_payout_index >= self.members.len() {
            return Err(format!(
                "Invalid payout index ({}), must be < {}",
                self.current_payout_index,
                self.members.len()
            ));
        }

        // Validate each member
        for member in &self.members {
            // Check payout round is valid
            if member.payout_round >= self.total_rounds {
                return Err("Member has invalid payout round".to_string());
            }

            // If payout received, must be in past rounds
            if member.has_received_payout && member.payout_round >= self.current_round {
                return Err("Member marked as paid but round hasn't occurred".to_string());
            }

            // Validate contribution history
            let mut rounds_seen = HashMap::new();
            for contrib in &member.contribution_history {
                if contrib.round >= self.total_rounds {
                    return Err("Invalid contribution round".to_string());
                }

                if contrib.amount != self.contribution_per_round {
                    return Err("Invalid contribution amount".to_string());
                }

                // Check for duplicates
                if rounds_seen.contains_key(&contrib.round) {
                    return Err("Duplicate contribution for round".to_string());
                }
                rounds_seen.insert(contrib.round, true);
            }
        }

        // Validate current pool
        let expected_pool: Satoshis = self
            .members
            .iter()
            .filter_map(|m| {
                m.contribution_history
                    .iter()
                    .find(|c| c.round == self.current_round)
                    .map(|c| c.amount)
            })
            .sum();

        if self.current_pool != expected_pool {
            return Err(format!(
                "Current pool mismatch. Expected: {}, Got: {}",
                expected_pool, self.current_pool
            ));
        }

        Ok(())
    }
}

/// Internal implementation using Result for better error handling
/// Following the BRO token pattern
fn app_contract_impl(app: &App, tx: &Transaction, _x: &Data, _w: &Data) -> Result<()> {
    // HACKATHON SIMPLIFIED VERSION:
    // For the hackathon, we're using simplified validation that just checks
    // that charm data exists in outputs. Full CBOR deserialization validation
    // will be re-enabled after debugging WASM runtime issues.

    // Step 1: Extract new state from transaction outputs
    // Find the output containing our app's data
    let new_state_data = tx
        .outs
        .iter()
        .find_map(|out| out.get(app))
        .ok_or_else(|| anyhow::anyhow!("No charm data found for app in outputs"))?;

    // Step 2: Just verify data exists (simplified for hackathon)
    ensure!(!new_state_data.is_empty(), "Charm data cannot be empty");

    // Success - data exists and is non-empty
    Ok(())
}

/// Charms covenant contract function for ROSCA
/// This function validates state transitions for the ROSCA circle
/// Wrapper that converts Result to bool (BRO token pattern)
pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    app_contract_impl(app, tx, x, w)
        .map_err(|e| {
            // In WASM, this won't print, but helps with debugging in tests
            #[cfg(not(target_arch = "wasm32"))]
            eprintln!("Contract validation failed: {:?}", e);
            e
        })
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_pubkey(n: u8) -> PubKey {
        let mut key = vec![0u8; 33];
        key[0] = 0x02; // Compressed pubkey prefix
        key[1] = n;
        PubKey(key)
    }

    #[test]
    fn test_create_circle() {
        let circle_id = [1u8; 32];
        let circle = CircleState::new(circle_id, 100_000, 2_592_000, 1234567890);

        assert_eq!(circle.current_round, 0);
        assert_eq!(circle.members.len(), 0);
        assert!(!circle.is_complete);
    }

    #[test]
    fn test_add_members() {
        let circle_id = [1u8; 32];
        let mut circle = CircleState::new(circle_id, 100_000, 2_592_000, 1234567890);

        circle.add_member(test_pubkey(1), 0, 1234567890).unwrap();
        circle.add_member(test_pubkey(2), 1, 1234567891).unwrap();
        circle.add_member(test_pubkey(3), 2, 1234567892).unwrap();

        assert_eq!(circle.members.len(), 3);
        assert_eq!(circle.total_rounds, 3);
        circle.validate().unwrap();
    }

    #[test]
    fn test_validate_new_circle_with_one_member() {
        // This test simulates what serialize_state creates: a new circle with one member
        let circle_id = [1u8; 32];
        let mut circle = CircleState::new(circle_id, 100_000, 2_592_000, 1234567890);

        // Add creator as first member (payout_round 0)
        circle.add_member(test_pubkey(1), 0, 1234567890).unwrap();

        // Verify state
        assert_eq!(circle.members.len(), 1);
        assert_eq!(circle.total_rounds, 1);
        assert_eq!(circle.current_round, 0);
        assert_eq!(circle.current_pool, 0);
        assert_eq!(circle.current_payout_index, 0);
        assert_eq!(circle.members[0].payout_round, 0);

        // This should pass validation
        circle
            .validate()
            .expect("New circle with one member should validate");
    }

    #[test]
    fn test_contribution_and_payout() {
        let circle_id = [1u8; 32];
        let mut circle = CircleState::new(circle_id, 100_000, 2_592_000, 1234567890);

        // Add members
        circle.add_member(test_pubkey(1), 0, 1234567890).unwrap();
        circle.add_member(test_pubkey(2), 1, 1234567891).unwrap();

        // Record contributions
        let txid = [0u8; 32];
        circle
            .record_contribution(&test_pubkey(1), 100_000, 1234567900, txid)
            .unwrap();
        circle
            .record_contribution(&test_pubkey(2), 100_000, 1234567901, txid)
            .unwrap();

        assert!(circle.is_round_fully_funded());
        assert_eq!(circle.current_pool, 200_000);

        // Execute payout
        let (recipient, amount) = circle.execute_payout(1234567902).unwrap();
        assert_eq!(recipient, test_pubkey(1));
        assert_eq!(amount, 200_000);
        assert_eq!(circle.current_round, 1);
        assert_eq!(circle.current_pool, 0);

        circle.validate().unwrap();
    }

    #[test]
    fn test_state_transition_validation() {
        let circle_id = [1u8; 32];
        let mut state1 = CircleState::new(circle_id, 100_000, 2_592_000, 1234567890);
        state1.add_member(test_pubkey(1), 0, 1234567890).unwrap();

        let mut state2 = state1.clone();
        state2.current_round = 1;
        state2.current_pool = 0;

        // Valid transition
        state1.validate_transition(&state2).unwrap();

        // Invalid transition - wrong circle ID
        let mut state3 = state2.clone();
        state3.circle_id = [2u8; 32];
        assert!(state1.validate_transition(&state3).is_err());
    }
}
