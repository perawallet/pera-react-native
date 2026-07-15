/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { mnemonicToEntropy } from '@scure/bip39'
// The `.js` suffix matches how `packages/kms` imports the same wordlist;
// Vite's library build excludes the wordlist entry without it and the
// downstream consumer (vitest, RN bundler) fails to resolve.
import { wordlist } from '@scure/bip39/wordlists/english.js'

// ARC-35 (Algorand Offline Wallet Backup Protocol) primitives. The
// secretbox open is shared with the Pera Web flow — see
// `../../shared/secretbox.ts`. What's left here is ARC-35-specific:
//   - sdk/backup.go      BackupMnemonicToKey, GenerateBackupCipherKey
//   - sdk/encryption.go  Encrypt / Decrypt (nacl/secretbox; nonce prepended)

/** UTF-8 bytes of the HMAC key string fixed by ARC-35. */
const CIPHER_KEY_CONTEXT = new TextEncoder().encode('Algorand export 1.0')

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
