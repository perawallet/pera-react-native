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

import nacl from 'tweetnacl'
import { KeyManagementError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { KeyPair, KeyType, KMSAlgo25Session } from '../models'
import { seedFromMnemonic } from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { makeKeyPair } from '../utils'
import { useSecureStorageService } from '@perawallet/wallet-extension-platform'

const MNEMONIC_STORAGE_PREFIX = 'mnemonic-'

export const useAlgo25 = () => {
    const { saveKey, checkAccess, keyStore } = useKMSService()
    const secureStorage = useSecureStorageService()

    const createAlgo25Key = async (params: {
        id?: string
        mnemonic?: string
    }) => {
        if (!params.mnemonic) {
            throw new KeyManagementError(
                'New algo25 creation not implemented yet',
            )
        }

        const keyId = params.id ?? generateOrderedUniqueId()
        const seed = seedFromMnemonic(params.mnemonic)

        // Compute public key locally before import
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
        const publicKey = encodeAddress(naclKeyPair.publicKey)

        // Import key into keystore extension
        const keystoreKeyId = await keyStore.import(
            {
                privateKey: seed,
                type: 'ecc',
                algorithm: 'EdDSA',
                extractable: false,
                keyUsages: ['sign'] as KeyUsage[],
            },
            'raw',
        )

        // Store mnemonic separately in secure storage for recovery
        await secureStorage.setItem(
            `${MNEMONIC_STORAGE_PREFIX}${keyId}`,
            new TextEncoder().encode(params.mnemonic),
        )

        seed.fill(0)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId,
            publicKey,
            type: KeyType.Algo25Key,
        })

        return await saveKey(keyPair)
    }

    const withAlgo25Session = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSAlgo25Session) => Promise<T>,
    ): Promise<T> => {
        checkAccess(key, domain)

        if (!key.keystoreKeyId) {
            throw new KeyManagementError(
                'Key has no keystore ID. Migration may be required.',
            )
        }

        const keystoreKeyId = key.keystoreKeyId
        const keyId = key.id ?? ''

        const session: KMSAlgo25Session = {
            signTransaction: async (encodedTx: Uint8Array) =>
                keyStore.sign(keystoreKeyId, encodedTx),
            signData: async (data: Uint8Array) =>
                keyStore.sign(keystoreKeyId, data),
            getPublicKey: () => {
                throw new KeyManagementError(
                    'Public key is available from the KeyPair.publicKey field',
                )
            },
            getMnemonic: () => {
                // Mnemonic recovery requires async access to secure storage.
                // This sync interface is preserved for backward compatibility
                // but callers needing the mnemonic should read it directly
                // from secure storage using the key `mnemonic-{keyId}`.
                throw new KeyManagementError(
                    `Mnemonic must be read async from secure storage key: ${MNEMONIC_STORAGE_PREFIX}${keyId}`,
                )
            },
        }

        return handler(session)
    }

    return {
        createAlgo25Key,
        withAlgo25Session,
    }
}
