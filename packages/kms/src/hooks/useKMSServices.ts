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

import {
    AppError,
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import { AccessControlPermission, KeyPair, StoredKeyMaterial } from '../models'
import { KeyAccessError } from '../errors'
import { useWallet } from '@perawallet/wallet-core-provider'
import { keyPairToKey } from '../utils'
import { clearKeyData, KeyData } from '@algorandfoundation/keystore'

export const useKMSService = () => {
    const provider = useWallet()
    return {
        deleteKey: provider.key.store.remove,
        saveKey: async (key: KeyPair, keyData: StoredKeyMaterial) => {
            const id = await provider.key.store.import(
                keyPairToKey(key, decodeFromBase64(keyData.seed)),
                'raw',
            )
            return {
                ...key,
                id,
                privateDataStorageKey: key.privateDataStorageKey ?? id,
            }
        },
        // Only the keystore should be allowed to access key material
        executeWithKey: async function executeWithKey<T>(
            key: KeyPair,
            domain: string,
            handler: (privateKey: StoredKeyMaterial) => Promise<T>,
        ) {
            let unsafeKey: KeyData | null = null
            try {
                if (key.acl?.length) {
                    const hasAccess = key.acl.some(
                        acl =>
                            acl.domains.includes(domain) &&
                            acl.permissions.includes(
                                AccessControlPermission.ReadPrivate,
                            ),
                    )

                    if (!hasAccess) {
                        throw new KeyAccessError()
                    }
                }
                if (!key.privateDataStorageKey) {
                    throw new KeyAccessError()
                }
                // Keys ID's should be unique and able to be reused across storage engines
                unsafeKey = await provider.key.store.export(
                    key?.id ?? key.privateDataStorageKey,
                )
                if (typeof unsafeKey.privateKey === 'undefined') {
                    throw new KeyAccessError()
                }

                return await handler({
                    seed: encodeToBase64(unsafeKey.privateKey),
                    seedFormat: 'base64',
                })
            } catch (error) {
                if (error instanceof AppError) {
                    throw error
                }
                throw new KeyAccessError(error as Error)
            } finally {
                clearKeyData(unsafeKey)
            }
        },
    }
}
