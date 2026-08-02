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
 * NOT a BIP-39 seed — no PBKDF2, no `mnemonic` salt. This is the raw 16 bytes
 * of entropy the 12-word phrase encodes, checksum-verified, which
 * `generateBackupCipherKey` then stretches to the 32-byte symmetric key.
 */
export const backupMnemonicToKey = (mnemonic: string): Uint8Array => {
    const normalized = mnemonic.trim().split(/\s+/).join(' ')
    return mnemonicToEntropy(normalized, wordlist)
}

/**
 * The context string is the HMAC *key*, not the message — argument order
 * matches the Go reference `hmac.New(sha256, context).Write(seed)`.
 */
export const generateBackupCipherKey = (seed: Uint8Array): Uint8Array =>
    hmac(sha256, CIPHER_KEY_CONTEXT, seed)
