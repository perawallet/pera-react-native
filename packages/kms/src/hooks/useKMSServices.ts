import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { useKeyManagerStore } from '../store'
import { AppError, logger } from '@perawallet/wallet-core-shared'
import { AccessControlPermission, KeyPair, StoredKeyMaterial } from '../models'
import { v7 as uuid } from 'uuid'
import { KeyAccessError } from '../errors'
import { useCallback } from 'react'

export const useKMSService = () => {
    const secureStorage = useSecureStorageService()
    const addKey = useKeyManagerStore(state => state.addKey)
    const getKey = useKeyManagerStore(state => state.getKey)
    const removeKey = useKeyManagerStore(state => state.removeKey)

    const saveKey = useCallback(
        async (key: KeyPair, keyData: StoredKeyMaterial) => {
            const storageKey = key.id ?? uuid()

            const stringifiedObj = JSON.stringify(keyData)

            key.id = storageKey
            key.privateDataStorageKey = key.publicKey.length
                ? `${key.type}-${key.publicKey}`
                : `${key.type}-${storageKey}`
            key.createdAt = new Date()
            logger.debug('Creating key', key)
            await secureStorage.setItem(
                key.privateDataStorageKey,
                new TextEncoder().encode(stringifiedObj),
            )
            addKey(key)

            return key
        },
        [addKey, secureStorage],
    )

    const deleteKey = useCallback(
        async (id: string) => {
            const key = getKey(id)
            if (!key) {
                return
            }

            if (key.privateDataStorageKey) {
                await secureStorage.removeItem(key.privateDataStorageKey)
            }
            logger.debug('Deleting key', key)
            removeKey(id)
        },
        [getKey, removeKey, secureStorage],
    )

    const executeWithKey = useCallback(
        async <T>(
            key: KeyPair,
            domain: string,
            handler: (privateKey: StoredKeyMaterial) => Promise<T>,
        ) => {
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

            const privateKey = await secureStorage.getItem(
                key.privateDataStorageKey,
            )

            if (!privateKey) {
                throw new KeyAccessError()
            }

            try {
                const storedKey: StoredKeyMaterial = JSON.parse(
                    new TextDecoder().decode(privateKey),
                )
                const result = await handler(storedKey)

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
        [secureStorage],
    )

    return {
        deleteKey,
        saveKey,
        executeWithKey,
    }
}
