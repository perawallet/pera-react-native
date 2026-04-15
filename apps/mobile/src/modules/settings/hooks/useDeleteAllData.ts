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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    deleteDatabase,
    initializeDatabase,
    resetAllCollections,
} from '@perawallet/wallet-core-database'
import { useDeleteDeviceMutation } from '@perawallet/wallet-core-device'
import { useKMS } from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import { clearAllStores, logger } from '@perawallet/wallet-core-shared'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import {
    getProvider,
    clearKeystore,
} from '@perawallet/wallet-extension-provider'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

const ACCOUNTS_STORE_NAME = 'accounts-store'
const REACT_QUERY_PERSIST_KEY = 'reactQuery'

export const clearAccountsStore = () => {
    useAccountsStore.getState().resetState()
    useAccountsStore.persist.clearStorage()
}

type UseDeleteAllDataResult = {
    deleteAllData: () => Promise<void>
}

export const useDeleteAllData = (): UseDeleteAllDataResult => {
    const { keys, deleteKey } = useKMS()
    const queryClient = useQueryClient()
    const { mutateAsync: deleteDevices } = useDeleteDeviceMutation()
    const { savePin } = usePinCode()
    const { network } = useNetwork()
    const { deleteAllSessions } = useWalletConnect(network)

    const deleteAllData = useCallback(async () => {
        // 1. Clear React Query — both in-memory and persisted cache
        if (queryClient) {
            queryClient.removeQueries()
        }
        getProvider().keyValueStorage.removeItem(REACT_QUERY_PERSIST_KEY)

        // 2. Delete all cryptographic keys from keystore
        if (keys) {
            await Promise.allSettled(
                Array.from(keys.values()).map(async k => {
                    if (k.id) {
                        await deleteKey(k.id)
                    }
                }),
            )
        }

        // 3. Bulk-clear keystore MMKV as safety net for any orphaned keys
        try {
            await clearKeystore()
        } catch (e) {
            logger.error('Failed to clear keystore', { error: e })
        }

        // 4. Disconnect WalletConnect peers before wiping store data
        try {
            await deleteAllSessions()
        } catch (e) {
            logger.error('Failed to disconnect WalletConnect sessions', {
                error: e,
            })
        }

        // 5. Unregister device from push notification backend
        try {
            await deleteDevices()
        } catch (e) {
            logger.error('Failed to delete devices', { error: e })
        }

        // 6. Clear PIN and biometrics from secure storage
        await savePin(null)

        // 7. Delete SQLite database file, then re-initialize with empty DB
        // so the app remains functional after cleanup
        try {
            await deleteDatabase(getProvider().database)
            await initializeDatabase(getProvider().database)
        } catch (e) {
            logger.error('Failed to delete database', { error: e })
        }

        // 8. Wipe every TanStack-DB-style collection backed by MMKV.
        // Collections persist independently of the SQLite file, so
        // `deleteDatabase` does not touch them — they need their own
        // reset hook so the app boots into a fully empty state.
        try {
            resetAllCollections()
        } catch (e) {
            logger.error('Failed to reset collections', { error: e })
        }

        clearAllStores({ skip: [ACCOUNTS_STORE_NAME] })
    }, [
        queryClient,
        keys,
        deleteKey,
        savePin,
        deleteDevices,
        deleteAllSessions,
    ])

    return { deleteAllData }
}
