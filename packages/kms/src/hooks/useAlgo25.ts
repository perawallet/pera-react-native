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
import {
    generateOrderedUniqueId,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { KeyType, KMSAlgo25Session } from '../models'
import type { KeyPair } from '../models'
import {
    seedFromMnemonic,
    mnemonicFromSeed,
} from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { useKMSService } from './useKMSServices'
import { makeKeyPair, peraMetadataFor, PeraKeyKind } from '../utils'
import { zeroBytes } from '../crypto/secure-memory'
import { ALGO25_KEYSTORE_TYPE } from '../constants'
import type { KeyData, KeyId } from '@algorandfoundation/keystore'
import { commitTypedSecret } from '../storage/typedSecret'

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

        let seed: Optional<Uint8Array>
        let naclKeyPair: Optional<nacl.SignKeyPair>
        let committedRoot = false

        try {
            if (params?.mnemonic) {
                seed = seedFromMnemonic(params.mnemonic)
            } else {
                seed = nacl.randomBytes(32)
            }

            naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
            const publicKey = encodeAddress(naclKeyPair.publicKey)

            // Must await: `commitTypedSecret` reads the `seed` buffer inside
            // `commit({ privateKey: new Uint8Array(seed) })` *after* its
            // dynamic imports resolve. Without await, the `finally` zeros
            // the bytes first and the keystore persists 32 zero bytes —
            // every subsequent session would derive the wrong (zero-seed)
            // keypair.
            await commitTypedSecret({
                id: keyId,
                type: ALGO25_KEYSTORE_TYPE,
                bytes: seed,
                algorithm: 'EdDSA',
                keyUsages: ['sign'],
                publicKey: naclKeyPair.publicKey,
                // Stamp the kind so wallet-domain consumers can identify
                // this entry as an Algo25 root even when the keystore
                // persists it with a less-specific `type` field.
                metadata: peraMetadataFor({
                    createdAt: new Date(),
                    kind: PeraKeyKind.Algo25Root,
                }),
            })
            committedRoot = true

            const seedKeyId = await keyStore.import(
                {
                    id: `${keyId}-seed`,
                    type: 'hd-seed',
                    algorithm: 'raw',
                    extractable: true,
                    privateKey: new Uint8Array(seed),
                } as unknown as Omit<KeyData, 'id'>,
                'raw',
            )

            const keyPair = makeKeyPair({
                id: keyId,
                keystoreKeyId: keyId,
                publicKey,
                type: KeyType.Algo25Key,
            })

            return { keyPair, seedKeyId }
        } catch (e) {
            // Roll back the algo25 root if we committed it but a later step
            // failed — leaving the root orphaned without its seed-key would
            // produce an account that can sign but can't recover its
            // mnemonic. Best-effort: if the rollback itself throws (e.g. a
            // keystore race), the original error wins.
            if (committedRoot) {
                try {
                    await keyStore.remove(keyId)
                } catch {
                    /* swallow */
                }
            }
            logger.error('createAlgo25Key failed', { error: e })
            throw e
        } finally {
            zeroBytes(seed, naclKeyPair?.secretKey)
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
