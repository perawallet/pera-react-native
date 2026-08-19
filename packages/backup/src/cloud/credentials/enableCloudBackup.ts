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
import { encodeToBase64, logger } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import { registerBackup } from '../api'
import type { BackupId, DeviceId } from '../models'
import { deleteBackupKeys, persistBackupKeys } from './keyStorage'

type EnableCloudBackupParams = {
    mnemonic: string[]
    salt: string
    deviceId: DeviceId
    network: Network
}

export type EnableCloudBackupResult = {
    backupId: BackupId
}

const cleanUpAfterRegistrationFailure = async (): Promise<void> => {
    try {
        await deleteBackupKeys()
    } catch (cleanupError) {
        logger.error(
            'enableCloudBackup: failed to clean up keys after registration error',
            {
                error:
                    cleanupError instanceof Error
                        ? cleanupError.message
                        : String(cleanupError),
            },
        )
    }
}

export const enableCloudBackup = async ({
    mnemonic,
    salt,
    deviceId,
    network,
}: EnableCloudBackupParams): Promise<EnableCloudBackupResult> => {
    // Lazy import keeps tweetnacl/@noble/argon2 out of the startup module graph.
    const { buildBackupRegisterProof, deriveBackupKeys } =
        await import('../crypto')

    const { backupId, encryptionKey, authPublicKey, authSecretKey } =
        await deriveBackupKeys({ mnemonic, salt })

    try {
        await persistBackupKeys({ encryptionKey, authSecretKey, mnemonic })

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
            await cleanUpAfterRegistrationFailure()
            throw error
        }
    } finally {
        zeroBytes(encryptionKey)
        zeroBytes(authSecretKey)
    }

    return { backupId }
}
