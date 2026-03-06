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
import {
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import { clearKeyData } from '@algorandfoundation/keystore'

const xhd = new XHDWalletAPI()
import { KeyPair, KeyType } from '../models'
import { makeKeyPair } from '../utils'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'
import { useKeyManagerStore } from '../store'
import {
    entropyToMnemonic,
    generateHDMasterKey,
} from '../crypto/hdwallet-utils'

export const useHDWallet = () => {
    const { saveKey, checkAccess, keyStore } = useKMSService()
    const addKey = useKeyManagerStore(state => state.addKey)
    const keys = useKeyManagerStore(state => state.keys)

    const createHDWalletKey = async (params?: {
        id?: string
        mnemonic?: string
    }) => {
        const keyId = params?.id ?? generateOrderedUniqueId()
        const masterKey = await generateHDMasterKey(params?.mnemonic)

        // Convert BIP39 seed to XHD root key (96 bytes: kL || kR || chainCode)
        const rootKey = fromSeed(masterKey.seed)

        // Import root key into keystore with entropy in metadata for mnemonic recovery
        const keystoreKeyId = await keyStore.import(
            {
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: rootKey,
                metadata: { name: keyId, entropy: masterKey.entropy },
            },
            'raw',
        )

        masterKey.seed.fill(0)
        rootKey.fill(0)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId,
            type: KeyType.HDWalletRootKey,
        })

        return await saveKey(keyPair)
    }

    /**
     * Migrates a pre-existing hd-seed key to hd-root-key type.
     * The react-native-keystore's generate function only handles hd-seed → hd-root-key
     * conversion for P256 keys, not Ed25519. This re-imports the key as hd-root-key.
     */
    const migrateRootKeyType = async (
        keystoreKeyId: string,
    ): Promise<string> => {
        const keyData = await keyStore.export(keystoreKeyId)
        if (!keyData.privateKey) {
            throw new KeyManagementError(
                'Cannot migrate root key: no private key found',
            )
        }

        const newKeystoreKeyId = await keyStore.import(
            {
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: keyData.privateKey,
                metadata: keyData.metadata ?? {},
            },
            'raw',
        )

        // Update KeyPair in the store with the new keystoreKeyId
        for (const keyPair of keys.values()) {
            if (keyPair.keystoreKeyId === keystoreKeyId) {
                addKey({ ...keyPair, keystoreKeyId: newKeystoreKeyId })
                break
            }
        }

        await keyStore.remove(keystoreKeyId)

        return newKeystoreKeyId
    }

    const generateDerivedKey = async (
        keystoreRootKeyId: string,
        account: number,
        keyIndex: number,
        derivationType: number,
    ): Promise<string> => {
        try {
            return await keyStore.generate({
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
        } catch (error) {
            // Pre-existing accounts have root keys stored as hd-seed type
            // which generateXHDFromParent rejects. Migrate and retry.
            const message =
                error instanceof Error ? error.message : String(error)
            if (message.includes('hd-root-key')) {
                const newKeystoreKeyId =
                    await migrateRootKeyType(keystoreRootKeyId)
                return keyStore.generate({
                    type: 'hd-derived-ed25519',
                    algorithm: 'EdDSA',
                    extractable: false,
                    keyUsages: ['sign'],
                    params: {
                        parentKeyId: newKeystoreKeyId,
                        account,
                        index: keyIndex,
                        context: KeyContext.Address,
                        derivation: derivationType,
                    },
                })
            }
            throw error
        }
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

        const session: KMSHDWalletSession = {
            getPublicKey: async params => {
                const derivedKeyId = await generateDerivedKey(
                    keystoreKeyId,
                    params.account,
                    params.keyIndex,
                    params.derivationType,
                )
                const derivedKeyData = await keyStore.export(derivedKeyId)
                if (!derivedKeyData.publicKey) {
                    throw new KeyManagementError(
                        'Derived key does not have a public key',
                    )
                }
                return derivedKeyData.publicKey
            },
            signTransaction: async (params, encodedTx) => {
                // TODO: Route through keyStore.sign() once upstream supports Algorand transaction signing.
                // keyStore.sign() routes through xhd.signData(Encoding.NONE) which rejects
                // Algorand protocol tags ("TX", "MX", etc.). signAlgoTransaction bypasses validation.
                // encodedTx already includes the "TX" prefix from encodeTransaction.
                const rootKeyData = await keyStore.export(keystoreKeyId)
                if (!rootKeyData.privateKey) {
                    throw new KeyManagementError(
                        'Root key not found in keystore',
                    )
                }
                try {
                    return await xhd.signAlgoTransaction(
                        rootKeyData.privateKey,
                        KeyContext.Address,
                        params.account,
                        params.keyIndex,
                        encodedTx,
                        params.derivationType,
                    )
                } finally {
                    clearKeyData(rootKeyData)
                }
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
                const keyData = await keyStore.export(keystoreKeyId)
                const entropy = keyData.metadata?.entropy as string | undefined
                if (!entropy) {
                    throw new KeyManagementError(
                        'Entropy not found in keystore metadata',
                    )
                }
                return entropyToMnemonic(Buffer.from(entropy, 'hex'))
            },
        }

        return handler(session)
    }

    return {
        createHDWalletKey,
        generateDerivedKey,
        withHDSession,
    }
}
