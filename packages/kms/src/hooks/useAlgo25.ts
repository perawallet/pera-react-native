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
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { KeyType, KMSAlgo25Session } from '../models'
import type { KeyPair } from '../models'
import type { MnemonicWordAtPosition } from '../models/session'
import {
    seedFromMnemonic,
    mnemonicFromSeed,
} from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { makeKeyPair } from '../utils'
import { pickDistinctIndexes } from '../crypto/random'
import type { KeyData, KeyId } from '@algorandfoundation/keystore'

export type Algo25KeyResult = {
    keyPair: KeyPair
    seedKeyId: KeyId
}

export const useAlgo25 = () => {
    const { saveKey, checkAccess, keyStore, withExportedKey } = useKMSService()

    const createAlgo25Key = async (params?: {
        id?: string
        mnemonic?: string
    }): Promise<Algo25KeyResult> => {
        const keyId = params?.id ?? generateOrderedUniqueId()

        let seed: Uint8Array

        try {
            if (params?.mnemonic) {
                seed = seedFromMnemonic(params.mnemonic)
            } else {
                seed = nacl.randomBytes(32)
            }
        } catch (e) {
            logger.error('createAlgo25Key failed', { error: e })
            throw e
        }

        // Compute keypair for import into keystore
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
        const publicKey = encodeAddress(naclKeyPair.publicKey)

        // Note: The KeyStoreAPI type omits 'id' from import(), but the
        // hd-derived-ed25519 path in importEd25519Key requires it (no auto-generation).
        const keystoreKeyId = await keyStore.import(
            {
                id: keyId,
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: true,
                publicKey: naclKeyPair.publicKey,
                privateKey: naclKeyPair.secretKey,
            } as unknown as Omit<KeyData, 'id'>,
            'raw',
        )

        // Import raw seed as a separate keystore key for mnemonic recovery
        let seedKeyId: KeyId
        try {
            seedKeyId = await keyStore.import(
                {
                    id: `${keyId}-seed`,
                    type: 'hd-seed',
                    algorithm: 'raw',
                    extractable: true,
                    privateKey: new Uint8Array(seed),
                } as unknown as Omit<KeyData, 'id'>,
                'raw',
            )
        } catch (e) {
            await keyStore.remove(keystoreKeyId)
            throw e
        }

        seed.fill(0)
        naclKeyPair.secretKey.fill(0)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId,
            publicKey,
            type: KeyType.Algo25Key,
        })

        return { keyPair: await saveKey(keyPair), seedKeyId }
    }

    const withAlgo25Session = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSAlgo25Session) => Promise<T>,
        seedKeyId?: string,
    ): Promise<T> => {
        checkAccess(key, domain)

        const keystoreKeyId = key.keystoreKeyId

        if (!keystoreKeyId) {
            throw new KeyManagementError('Key does not have a keystore key ID')
        }

        // Algo25 keys are standalone Ed25519 keys without a parent root key,
        // so we export key material and sign locally with nacl
        return withExportedKey(keystoreKeyId, async keyData => {
            if (!keyData.privateKey) {
                throw new KeyManagementError('Key not found in keystore')
            }

            const seed = keyData.privateKey.slice(0, 32)
            const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)

            const resolveMnemonicWords = async (): Promise<string[]> => {
                if (!seedKeyId) {
                    throw new KeyManagementError('Seed key ID not provided')
                }
                return withExportedKey(seedKeyId, seedKeyData => {
                    if (!seedKeyData.privateKey) {
                        throw new KeyManagementError(
                            'Seed key not found in keystore',
                        )
                    }
                    return mnemonicFromSeed(
                        seedKeyData.privateKey.slice(0, 32),
                    ).split(' ')
                })
            }

            const session: KMSAlgo25Session = {
                signTransaction: async (encodedTx: Uint8Array) =>
                    nacl.sign.detached(encodedTx, naclKeyPair.secretKey),
                signData: async (data: Uint8Array) =>
                    nacl.sign.detached(data, naclKeyPair.secretKey),
                getPublicKey: () => naclKeyPair.publicKey,
                getMnemonic: async () => {
                    const words = await resolveMnemonicWords()
                    return new TextEncoder().encode(words.join(' '))
                },
                getRandomMnemonicWords: async (
                    count: number,
                ): Promise<MnemonicWordAtPosition[]> => {
                    const words = await resolveMnemonicWords()
                    const indexes = pickDistinctIndexes(
                        count,
                        words.length,
                    ).sort((a, b) => a - b)
                    return indexes.map(index => ({
                        index,
                        word: words[index],
                    }))
                },
            }

            try {
                return await handler(session)
            } finally {
                seed.fill(0)
                naclKeyPair.secretKey.fill(0)
            }
        })
    }

    return {
        createAlgo25Key,
        withAlgo25Session,
    }
}
