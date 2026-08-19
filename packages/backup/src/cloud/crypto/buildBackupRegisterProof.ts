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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { BackupId, DeviceId } from '../models'

const NONCE_RANDOM_BYTES = 16

// Algorand `signData` (signBytes) domain-separation prefix. The backend verifies
// the registration proof as an Algorand-signed message, so the signed bytes are
// `"MX" || message` — matching the wallet's signData behaviour.
const ALGORAND_SIGN_PREFIX = 'MX'

type BackupRegisterMessageParams = {
    backupId: BackupId
    deviceId: DeviceId
    nonce: string
    publicKey: string
}

type BackupRegisterProofParams = {
    backupId: BackupId
    deviceId: DeviceId
    publicKey: string
    authSecretKey: Uint8Array
}

export type BackupRegisterProof = {
    nonce: string
    signature: string
}

export const buildBackupRegisterMessage = ({
    backupId,
    deviceId,
    nonce,
    publicKey,
}: BackupRegisterMessageParams): string =>
    `REGISTER|${backupId}|${deviceId}|${nonce}|${publicKey}`

export const buildBackupRegisterProof = ({
    backupId,
    deviceId,
    publicKey,
    authSecretKey,
}: BackupRegisterProofParams): BackupRegisterProof => {
    const nonce = `${Date.now()}.${encodeToBase64(
        nacl.randomBytes(NONCE_RANDOM_BYTES),
    )}`
    const message = buildBackupRegisterMessage({
        backupId,
        deviceId,
        nonce,
        publicKey,
    })
    const signedBytes = new TextEncoder().encode(
        `${ALGORAND_SIGN_PREFIX}${message}`,
    )
    const signature = encodeToBase64(
        nacl.sign.detached(signedBytes, authSecretKey),
    )
    return { nonce, signature }
}
