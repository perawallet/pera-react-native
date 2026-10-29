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

import type { Nullable } from '@perawallet/wallet-core-shared'

/** The outer JSON inside the base64-encoded backup file. */
export type SecureBackupEnvelope = {
    version: string
    suite: string
    ciphertext: string
}

// A secure backup only encodes an account holding one signing key (`single`)
// or a watched one (`watch`); the chain's adapter maps its own account kinds
// onto these two.
export const SecureBackupAccountKind = {
    Single: 'single',
    Watch: 'watch',
} as const

export type SecureBackupAccountKind =
    (typeof SecureBackupAccountKind)[keyof typeof SecureBackupAccountKind]

/**
 * One account row inside the decrypted payload, normalized to camelCase. For
 * `Single`, `privateKey` carries the 64-byte secret key (seed || publicKey).
 * For `Watch`, `privateKey` is null.
 */
export type SecureBackupAccount = {
    address: string
    name: Nullable<string>
    kind: SecureBackupAccountKind
    privateKey: Nullable<Uint8Array>
}

export type SecureBackupPayload = {
    accounts: SecureBackupAccount[]
    providerName: Nullable<string>
    deviceId: Nullable<string>
}

export type SecureBackupImportablePartition = {
    importable: SecureBackupAccount[]
    alreadyImported: SecureBackupAccount[]
    unsupported: SecureBackupAccount[]
}
