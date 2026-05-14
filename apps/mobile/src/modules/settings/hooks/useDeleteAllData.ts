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

const REACT_QUERY_PERSIST_KEY = 'reactQuery'

export const clearAccountsStore = () => {
    // Clear persisted MMKV first, then reset in-memory. Doing it in this
    // order means the persist middleware's onChange listener (fired by
    // resetState's `set(initialState)`) writes the empty initialState
    // *after* we've removed any prior blob — so the storage entry ends
    // up with the empty defaults rather than racing with a pre-clear
    // setItem.
    useAccountsStore.persist.clearStorage()
    useAccountsStore.getState().resetState()
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

        // 8. Clear all registered stores INCLUDING the accounts store.
        // Previously this skipped accounts so the settings success modal
        // could render before the route tree switched to Onboarding —
        // but that left the accounts store populated for the entire
        // duration of the modal, and any code path that captured
        // `accounts` in a closure during that window would write the
        // old list back when its async work resolved (e.g. an in-flight
        // create-account handler from before the user opened settings,
        // or NameAccount's `useUpdateAccount` resolving with a stale
        // snapshot). Wipe accounts up front so there's no stale state
        // anywhere by the time the user lands back on Onboarding.
        clearAllStores()
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
