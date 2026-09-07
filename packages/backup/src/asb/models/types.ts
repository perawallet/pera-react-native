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

// ARC-35 envelope: the outer JSON that lives inside the base64-encoded
// backup file. The whole file is `base64(JSON.stringify(AsbBackupEnvelope))`.
export const ASB_BACKUP_PROTOCOL_VERSION = '1.0'
export const ASB_BACKUP_CIPHER_SUITE = 'HMAC-SHA256:sodium_secretbox_easy'

export const ASB_RECOVERY_MNEMONIC_WORD_COUNT = 12

export type AsbBackupEnvelope = {
    version: string
    suite: string
    ciphertext: string
}

// ASB only encodes accounts that the wallet can sign with (`single` =
// algo25) or watch (`watch`). HD wallets and hardware accounts are exported
// flat as individual algo25 entries.
// TODO(quantum, phase 2): the ASB envelope has no representation for
// post-quantum (Falcon) keys, so quantum accounts are neither exported nor
// importable here — they are silently absent from this format by design. A
// quantum-capable ASB kind is out of scope for this format.
export const AsbAccountKind = {
    Single: 'single',
    Watch: 'watch',
} as const

export type AsbAccountKind =
    (typeof AsbAccountKind)[keyof typeof AsbAccountKind]

/**
 * One account row inside the decrypted payload, normalized to camelCase. For
 * `Single`, `privateKey` carries the 64-byte tweetnacl-style secret key
 * (seed || publicKey). For `Watch`, `privateKey` is null.
 */
export type AsbBackupAccount = {
    address: string
    name: string | null
    kind: AsbAccountKind
    privateKey: Uint8Array | null
}

export type AsbBackupPayload = {
    accounts: AsbBackupAccount[]
    providerName: string | null
    deviceId: string | null
}
