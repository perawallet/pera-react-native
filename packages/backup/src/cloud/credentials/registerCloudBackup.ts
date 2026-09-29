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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import { registerBackup } from '../api'
import type { BackupId, DeviceId } from '../models'

type RegisterCloudBackupParams = {
    mnemonic: string[]
    salt: string
    deviceId: DeviceId
    network: Network
}

export type RegisterCloudBackupResult = {
    backupId: BackupId
    /** Live buffers. The caller retains them until the user enables the backup
     *  and owns zeroing them; nothing here writes to the device. */
    encryptionKey: Uint8Array
    authSecretKey: Uint8Array
    itemKey: Uint8Array
}

export const registerCloudBackup = async ({
    mnemonic,
    salt,
    deviceId,
    network,
}: RegisterCloudBackupParams): Promise<RegisterCloudBackupResult> => {
    // Lazy import keeps tweetnacl/@noble/argon2 out of the startup module graph.
    const { buildBackupRegisterProof, deriveBackupKeys } =
        await import('../crypto')

    const { backupId, encryptionKey, authPublicKey, authSecretKey, itemKey } =
        await deriveBackupKeys({ mnemonic, salt })

    try {
        const publicKey = encodeToBase64(authPublicKey)
        const { nonce, signature } = buildBackupRegisterProof({
            backupId,
            deviceId,
            publicKey,
            authSecretKey,
        })

        await registerBackup(network, {
            backup_id: backupId,
            public_key: publicKey,
            device_id: deviceId,
            nonce,
            wallet_signature: signature,
        })
    } catch (error) {
        zeroBytes(encryptionKey, authSecretKey, itemKey)
        throw error
    }

    return { backupId, encryptionKey, authSecretKey, itemKey }
}
