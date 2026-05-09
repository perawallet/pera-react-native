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

import type { KMSHDWalletSession } from '../models/session'
import { KeyContext } from '@algorandfoundation/xhd-wallet-api'
import { KeyPair, KeyType } from '../models'
import { makeKeyPair, peraMetadataFor, PeraKeyKind } from '../utils'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'
import { entropyToMnemonic } from '../crypto/hdwallet-utils'
import { prepareHDMasterKey } from '../crypto/prepare-hd-master-key'
import { zeroBytes } from '../crypto/secure-memory'
import type { KeyData, KeyId } from '@algorandfoundation/keystore'

export type HDWalletKeyResult = {
    keyPair: KeyPair
    entropyKeyId: KeyId
}

export const useHDWallet = () => {
    const { checkAccess, keyStore, withExportedKey } = useKMSService()

    const createHDWalletKey = async (params?: {
        id?: string
        mnemonic?: string
    }): Promise<HDWalletKeyResult> => {
        const prepared = await prepareHDMasterKey(params)
        return persistHDMasterKey({
            keyId: prepared.keyId,
            rootKey: prepared.rootKey,
            entropy: prepared.entropy,
        })
    }

    const persistHDMasterKey = async (prepared: {
        keyId: string
        rootKey: Uint8Array
        entropy: Uint8Array
    }): Promise<HDWalletKeyResult> => {
        const { keyId, rootKey, entropy } = prepared

        const keystoreKeyId = await keyStore.import(
            {
                id: keyId,
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: rootKey,
                metadata: {
                    name: keyId,
                    ...peraMetadataFor({
                        createdAt: new Date(),
                        kind: PeraKeyKind.HDWalletRoot,
                    }),
                },
            } as unknown as Omit<KeyData, 'id'>,
            'raw',
        )

        let entropyKeyId: KeyId
        try {
            entropyKeyId = await keyStore.import(
                {
                    id: `${keyId}-entropy`,
                    type: 'hd-seed',
                    algorithm: 'raw',
                    extractable: true,
                    privateKey: entropy,
                } as unknown as Omit<KeyData, 'id'>,
                'raw',
            )
        } catch (e) {
            await keyStore.remove(keystoreKeyId)
            throw e
        }

        zeroBytes(rootKey, entropy)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId,
            type: KeyType.HDWalletRootKey,
        })

        return { keyPair, entropyKeyId }
    }

    const generateDerivedKey = async (
        keystoreRootKeyId: string,
        account: number,
        keyIndex: number,
        derivationType: number,
    ): Promise<string> => {
        return keyStore.generate({
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            keyUsages: ['sign'],
            params: {
                parentKeyId: keystoreRootKeyId,
                account,
                index: keyIndex,
                context: KeyContext.Address,
                derivation: derivationType,
            },
        })
    }

    const withHDSession = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSHDWalletSession) => Promise<T>,
    ): Promise<T> => {
        checkAccess(key, domain)

        const keystoreKeyId = key.keystoreKeyId

        if (!keystoreKeyId) {
            throw new KeyManagementError('Key does not have a keystore key ID')
        }

        // The entropy key id is deterministic from the root key id — it's set
        // to `${key.id}-entropy` at creation time (see createHDWalletKey above).
        const entropyKeyId = `${key.id}-entropy`

        const resolveMnemonicWords = async (): Promise<string[]> => {
            return withExportedKey(entropyKeyId, entropyKeyData => {
                if (!entropyKeyData.privateKey) {
                    throw new KeyManagementError(
                        'Entropy key not found in keystore',
                    )
                }
                return entropyToMnemonic(
                    Buffer.from(entropyKeyData.privateKey),
                ).split(' ')
            })
        }

        const session: KMSHDWalletSession = {
            getPublicKey: async params => {
                const derivedKeyId = await generateDerivedKey(
                    keystoreKeyId,
                    params.account,
                    params.keyIndex,
                    params.derivationType,
                )
                return withExportedKey(derivedKeyId, keyData => {
                    if (!keyData.publicKey) {
                        throw new KeyManagementError(
                            'Derived key does not have a public key',
                        )
                    }
                    return keyData.publicKey
                })
            },
            signTransaction: async (params, encodedTx) => {
                const derivedKeyId = await generateDerivedKey(
                    keystoreKeyId,
                    params.account,
                    params.keyIndex,
                    params.derivationType,
                )
                return keyStore.sign(derivedKeyId, encodedTx)
            },
            signData: async (params, data) => {
                const derivedKeyId = await generateDerivedKey(
                    keystoreKeyId,
                    params.account,
                    params.keyIndex,
                    params.derivationType,
                )
                return keyStore.sign(derivedKeyId, data)
            },
            getMnemonic: async () => {
                const words = await resolveMnemonicWords()
                return new TextEncoder().encode(words.join(' '))
            },
        }

        return handler(session)
    }

    return {
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        withHDSession,
    }
}
