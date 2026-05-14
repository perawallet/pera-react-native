/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { mnemonicToEntropy } from '@scure/bip39'
// The `.js` suffix matches how `packages/kms` imports the same wordlist;
// Vite's library build excludes the wordlist entry without it and the
// downstream consumer (vitest, RN bundler) fails to resolve.
import { wordlist } from '@scure/bip39/wordlists/english.js'
import nacl from 'tweetnacl'

// ARC-35 (Algorand Offline Wallet Backup Protocol) primitives.
//
// Mirrors the Go reference implementation in algorand-go-mobile-sdk:
//   - sdk/backup.go      BackupMnemonicToKey, GenerateBackupCipherKey
//   - sdk/encryption.go  Encrypt / Decrypt (nacl/secretbox; nonce prepended)
//
// Tweetnacl's `secretbox` is wire-compatible with Go's `nacl/secretbox` and
// libsodium's `crypto_secretbox_easy`: XSalsa20-Poly1305, 24-byte nonce,
// 16-byte MAC prepended to the ciphertext. The on-disk layout here is
// `nonce (24) || sealed (mac || ciphertext)`.

/** UTF-8 bytes of the HMAC key string fixed by ARC-35. */
const CIPHER_KEY_CONTEXT = new TextEncoder().encode('Algorand export 1.0')

const NONCE_LENGTH = 24

/**
 * Recover the 16-byte BIP-39 entropy that seeds the backup key.
 *
 * Important: this is *not* a BIP-39 seed (no PBKDF2, no `mnemonic` salt). It
 * is the raw 16 bytes of entropy that the 12-word phrase encodes, verified
 * against the BIP-39 checksum. The 16 bytes are then fed into
 * `generateBackupCipherKey` to derive the 32-byte symmetric key.
 *
 * Throws if the phrase is the wrong length or has an invalid checksum.
 */
export const backupMnemonicToKey = (mnemonic: string): Uint8Array => {
    const normalized = mnemonic.trim().split(/\s+/).join(' ')
    return mnemonicToEntropy(normalized, wordlist)
}

/**
 * Derive the 32-byte secretbox key from the 16-byte BIP-39 entropy.
 *
 * HMAC-SHA256 with the string `"Algorand export 1.0"` as the HMAC key (not as
 * the message). The argument order matches the Go reference:
 * `hmac.New(sha256, []byte("Algorand export 1.0")).Write(seed)`.
 */
export const generateBackupCipherKey = (seed: Uint8Array): Uint8Array =>
    hmac(sha256, CIPHER_KEY_CONTEXT, seed)

/**
 * Decrypt an ARC-35 ciphertext blob: `nonce (24) || sealed`.
 *
 * Returns null when the MAC fails (wrong key) or the input is too short.
 * Throwing would conflate "wrong recovery phrase" with programmer error;
 * the caller decides how to surface the failure.
 */
export const asbSecretboxOpen = (
    payload: Uint8Array,
    key: Uint8Array,
): Uint8Array | null => {
    if (payload.length <= NONCE_LENGTH) {
        return null
    }
    // tweetnacl's `checkArrayTypes` uses a strict `instanceof Uint8Array`
    // against its own lexically-bound `Uint8Array`. When the input came from
    // a library that captured a *different* realm's constructor (jsdom is
    // the only environment where this happens in practice), the check
    // throws even though the bytes are correct. Copying into a fresh
    // `Uint8Array` here normalizes the realm. The 16 + ciphertext-length
    // copy is negligible compared to the secretbox MAC + decrypt that
    // follows, and production (React Native / Hermes) has a single realm
    // so the copy is effectively free there too.
    const normalized = new Uint8Array(payload)
    const nonce = normalized.subarray(0, NONCE_LENGTH)
    const sealed = normalized.subarray(NONCE_LENGTH)
    const normalizedKey = new Uint8Array(key)
    return nacl.secretbox.open(sealed, nonce, normalizedKey)
}
