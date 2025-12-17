import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { AppError, logger } from '@perawallet/wallet-core-shared'
import { KeyAccessError, KeyNotFoundError } from '../errors'
import { useKeyManagerStore } from '../store'
import { useCallback } from 'react'

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

            logger.debug("Executing with key", { keyId, key })

            if (!key) {
                throw new KeyNotFoundError(keyId)
            }

            if (key.acl?.length) {
                const hasAccess = key.acl.some(
                    acl =>
                        acl.domains.includes(domain) &&
                        acl.permissions.includes('read-private'),
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
