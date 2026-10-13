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

import nacl from 'tweetnacl'
import { sha256 } from '@noble/hashes/sha2.js'
import { encodeToBase64, bytesToHex } from '@perawallet/wallet-core-shared'

const NONCE_RANDOM_BYTES = 16

type BackupRequestMessageParams = {
    method: string
    path: string
    body?: string
    nonce: string
}

type BackupRequestProofParams = {
    method: string
    path: string
    body?: string
    authSecretKey: Uint8Array
}

export type BackupRequestProof = {
    nonce: string
    signature: string
}

// A bodyless request hashes the empty string, not the empty hash: the server
// signs `sha256(body ?? '')` unconditionally, so skipping the digest here fails
// auth on every GET and DELETE.
const computeBodyHash = (body = ''): string =>
    bytesToHex(sha256(new TextEncoder().encode(body)))

export const buildBackupRequestMessage = ({
    method,
    path,
    body,
    nonce,
}: BackupRequestMessageParams): string =>
    `${method.toUpperCase()}|${path}|${computeBodyHash(body)}|${nonce}`

export const buildBackupRequestProof = ({
    method,
    path,
    body,
    authSecretKey,
}: BackupRequestProofParams): BackupRequestProof => {
    const nonce = `${Date.now()}.${encodeToBase64(
        nacl.randomBytes(NONCE_RANDOM_BYTES),
    )}`
    const message = buildBackupRequestMessage({ method, path, body, nonce })
    const signature = nacl.sign.detached(
        new TextEncoder().encode(message),
        authSecretKey,
    )
    return { nonce, signature: encodeToBase64(signature) }
}
