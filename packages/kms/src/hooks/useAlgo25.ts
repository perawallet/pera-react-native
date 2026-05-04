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
import {
    seedFromMnemonic,
    mnemonicFromSeed,
} from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { makeKeyPair, peraMetadataFor } from '../utils'
import { zeroBytes } from '../crypto/secure-memory'
import { ALGO25_KEYSTORE_TYPE } from '../constants'
import type { KeyData, KeyId } from '@algorandfoundation/keystore'

// Algo25 sign is local: we export the seed and run tweetnacl in-process. The
// platform keystore's default `sign` handler is HD-only (it requires a
// `parentKeyId` parent) and would throw otherwise. Going through
// `keyStore.sign` with a `wrap('sign')` hook is also possible but introduces
// install-timing concerns; the local path is simpler and avoids them.

export type Algo25KeyResult = {
    keyPair: KeyPair
    seedKeyId: KeyId
}

export const useAlgo25 = () => {
    const { checkAccess, keyStore, withExportedKey } = useKMSService()

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

        // Compute keypair so we can store the public key alongside the seed.
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
        const publicKey = encodeAddress(naclKeyPair.publicKey)

        addKeyToKeystore(keyId, seed, naclKeyPair)

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
            await keyStore.remove(keyId)
            throw e
        }

        zeroBytes(seed, naclKeyPair.secretKey)

        const keyPair = makeKeyPair({
            id: keyId,
            keystoreKeyId: keyId,
            publicKey,
            type: KeyType.Algo25Key,
        })

        return { keyPair, seedKeyId }
    }

    // First-class Algo25 type: store via `commit()` directly because the
    // default `keyStore.import` rejects unknown types in its switch
    // statement. Signing is local (see withAlgo25Session below) — we never
    // route Algo25 through `keyStore.sign`, which is HD-only.
    // The privateKey is the 32-byte seed; nacl.sign.keyPair.fromSeed
    // reproduces the keypair on demand.
    // Lazy imports keep the kms package importable in test environments
    // that don't have react-native-mmkv (which
    // @algorandfoundation/react-native-keystore pulls in transitively).
    const addKeyToKeystore = async (
        keyId: string,
        seed: Uint8Array,
        naclKeyPair: nacl.SignKeyPair,
    ) => {
        try {
            const [{ commit }, { getKeystoreStore }] = await Promise.all([
                import('@algorandfoundation/react-native-keystore'),
                import('@perawallet/wallet-extension-provider'),
            ])
            await commit({
                store: getKeystoreStore(),
                keyData: {
                    id: keyId,
                    type: ALGO25_KEYSTORE_TYPE,
                    algorithm: 'EdDSA',
                    format: 'raw',
                    extractable: true,
                    keyUsages: ['sign'],
                    publicKey: naclKeyPair.publicKey,
                    privateKey: new Uint8Array(seed),
                    metadata: peraMetadataFor({ createdAt: new Date() }),
                } as unknown as KeyData,
            })
        } catch (e) {
            zeroBytes(seed, naclKeyPair.secretKey)
            throw e
        }
    }

    const withAlgo25Session = async <T>(
        key: KeyPair,
        domain: string,
        handler: (session: KMSAlgo25Session) => Promise<T>,
    ): Promise<T> => {
        checkAccess(key, domain)

        const keystoreKeyId = key.keystoreKeyId

        if (!keystoreKeyId) {
            throw new KeyManagementError('Key does not have a keystore key ID')
        }

        // The seed key id is deterministic from the root key id (see
        // createAlgo25Key above). Used only for mnemonic recovery.
        const seedKeyId = `${key.id}-seed`

        // Algo25 root holds the 32-byte seed in privateKey. Export it once
        // per session and reconstruct the keypair for both signing and
        // public-key reads. Bytes are zeroed in the inner finally.
        return withExportedKey(keystoreKeyId, async keyData => {
            if (!keyData.privateKey) {
                throw new KeyManagementError('Algo25 key not found in keystore')
            }

            const seed = keyData.privateKey.slice(0, 32)
            const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)

            const resolveMnemonicWords = async (): Promise<string[]> => {
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
            }

            try {
                return await handler(session)
            } finally {
                zeroBytes(seed, naclKeyPair.secretKey)
            }
        })
    }

    return {
        createAlgo25Key,
        withAlgo25Session,
    }
}
