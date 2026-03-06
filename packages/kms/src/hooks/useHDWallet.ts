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
import { fromSeed, KeyContext } from '@algorandfoundation/xhd-wallet-api'
import { KeyPair, KeyType } from '../models'
import { makeKeyPair } from '../utils'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'
import {
    entropyToMnemonic,
    generateHDMasterKey,
} from '../crypto/hdwallet-utils'

export const useHDWallet = () => {
    const { saveKey, checkAccess, keyStore } = useKMSService()

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

        logger.debug(
            `[TX_SIGN] withHDSession: keyId=${key.id ?? ''}, keystoreKeyId=${keystoreKeyId}`,
        )

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
                const derivedKeyId = await generateDerivedKey(
                    keystoreKeyId,
                    params.account,
                    params.keyIndex,
                    params.derivationType,
                )
                // Prepend "TX" prefix for Algorand transaction signing
                // The keystore uses signData(Encoding.NONE) internally
                const TX_PREFIX = new Uint8Array([84, 88])
                const prefixedTx = new Uint8Array(
                    TX_PREFIX.length + encodedTx.length,
                )
                prefixedTx.set(TX_PREFIX)
                prefixedTx.set(encodedTx, TX_PREFIX.length)
                return keyStore.sign(derivedKeyId, prefixedTx)
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
