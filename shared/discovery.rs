use sha2::{Digest, Sha256};

pub const PORT: u16 = 47918;
pub const REQUEST: &str = "SPOTDOCK_DISCOVER_V1:";
pub const OFFER: &str = "SPOTDOCK_OFFER_V1:";

pub fn valid_nonce(nonce: &str) -> bool {
    nonce.len() == 32 && nonce.bytes().all(|byte| byte.is_ascii_hexdigit())
}

pub fn proof(token: &str, nonce: &str) -> String {
    // HMAC-SHA256 prevents a LAN peer from forging an offer without the saved pairing key.
    let mut inner_key = [0x36_u8; 64];
    let mut outer_key = [0x5c_u8; 64];
    for (index, byte) in token.bytes().enumerate() {
        inner_key[index] ^= byte;
        outer_key[index] ^= byte;
    }
    let mut inner = Sha256::new();
    inner.update(inner_key);
    inner.update(nonce.as_bytes());
    let inner_hash = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(outer_key);
    outer.update(inner_hash);
    outer
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_matches_known_vector() {
        assert_eq!(
            proof("key", "The quick brown fox jumps over the lazy dog"),
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
        );
        let nonce = "0123456789abcdef0123456789abcdef";
        assert!(valid_nonce(nonce));
    }
}
