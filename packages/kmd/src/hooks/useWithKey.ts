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

import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { AppError, logger } from '@perawallet/wallet-core-shared'
import { KeyAccessError, KeyNotFoundError } from '../errors'
import { useKeyManagerStore } from '../store'
import { useCallback } from 'react'
import { AccessControlPermission } from '../models'

export const useWithKey = () => {
    const secureStorage = useSecureStorageService()
    const getKey = useKeyManagerStore(state => state.getKey)

    const executeWithKey = useCallback(
        async <T>(
            keyId: string,
            domain: string,
            handler: (privateKey: Uint8Array) => Promise<T>,
        ) => {
            const key = getKey(keyId)

            logger.debug('Executing with key', { keyId, key })

            if (!key) {
                throw new KeyNotFoundError(keyId)
            }

            if (key.acl?.length) {
                const hasAccess = key.acl.some(
                    acl =>
                        acl.domains.includes(domain) &&
                        acl.permissions.includes(AccessControlPermission.ReadPrivate),
                )

                if (!hasAccess) {
                    throw new KeyAccessError()
                }
            }

            if (!key.privateDataStorageKey) {
                throw new KeyAccessError()
            }

            const privateKey = await secureStorage.getItem(
                key.privateDataStorageKey,
            )

            if (!privateKey) {
                throw new KeyAccessError()
            }

            try {
                const result = await handler(privateKey)

                return result
            } catch (error) {
                if (error instanceof AppError) {
                    throw error
                }
                throw new KeyAccessError(error as Error)
            } finally {
                //blank out the memory again after using
                if (privateKey) {
                    privateKey.fill(0)
                }
            }
        },
        [getKey, secureStorage],
    )

    return {
        executeWithKey,
    }
}
