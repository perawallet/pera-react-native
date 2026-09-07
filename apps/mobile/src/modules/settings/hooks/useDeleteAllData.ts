/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { clearDatabase } from '@perawallet/wallet-core-database'
import { useDeleteDeviceMutation } from '@perawallet/wallet-core-device'
import { useKMS } from '@perawallet/wallet-core-kms'
import { isStoreDisabledError } from '@perawallet/wallet-core-passkeys'
import { usePinCode } from '@perawallet/wallet-core-security'
import { clearAllStores, logger } from '@perawallet/wallet-core-shared'
import {
    getProvider,
    clearKeystore,
} from '@perawallet/wallet-extension-provider'
import { useWalletConnectSessionsControl } from '@modules/walletconnect/hooks/useWalletConnectSessionsControl'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

const REACT_QUERY_PERSIST_KEY = 'reactQuery'

export const clearAccountsStore = () => {
    useAccountsStore.persist.clearStorage()
    useAccountsStore.getState().resetState()
}

type UseDeleteAllDataResult = {
    deleteAllData: () => Promise<void>
    /**
     * Same destructive sequence as `deleteAllData`, exposed without the
     * settings-flow modal coupling so other paths (notably the duress wipe)
     * can reuse it. Skips no steps — caller is responsible for any post-wipe
     * routing (e.g. clearAccountsStore + provisioning a decoy account).
     */
    wipeAllUserData: () => Promise<void>
}

export const useDeleteAllData = (): UseDeleteAllDataResult => {
    const { keys, deleteKey } = useKMS()
    const queryClient = useQueryClient()
    const { mutateAsync: deleteDevices } = useDeleteDeviceMutation()
    const { savePin } = usePinCode()
    const { deleteAllSessions } = useWalletConnectSessionsControl()

    const wipeAllUserData = useCallback(async () => {
        // 1. Abort in-flight queries before we destroy their data sources.
        // Cancellation reverts silently, so — unlike a failed refetch — it
        // never reaches the QueryCache error handler.
        if (queryClient) {
            await queryClient.cancelQueries()
        }

        // 2. Delete all cryptographic keys from keystore (this includes both
        // the regular PIN record and the duress PIN record, since both are
        // stored as canonical secret-key entries).
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

        // 4. Clear the native passkey-autofill mirror. The credential
        // providers keep their own copy of the master key, parent key id, and
        // stored credentials (iOS app-group UserDefaults + keychain, Android
        // MMKV) — none of it dies with the keystore. Trap: on Android,
        // `clearCredentials` wipes the ENTIRE shared "keystore" MMKV
        // (`PASSKEYS_MMKV_ID`), not just passkey records — only safe inside
        // this full wipe, where step 3 already destroyed that data. Never
        // call it from a selective flow.
        try {
            await getProvider().passkeyAutofill.clearCredentials()
        } catch (e) {
            // iOS ends the clear with an identity-store sync that rejects
            // with `storeDisabled` when Pera isn't the enabled provider; the
            // state clearing itself has completed by then.
            if (isStoreDisabledError(e)) {
                logger.warn(
                    'AutoFill identity store disabled; native passkey state cleared without identity sync',
                )
            } else {
                logger.error('Failed to clear native passkey autofill state', {
                    error: e,
                })
            }
        }

        // 5. Disconnect WalletConnect peers before wiping store data
        try {
            await deleteAllSessions()
        } catch (e) {
            logger.error('Failed to disconnect WalletConnect sessions', {
                error: e,
            })
        }

        // 6. Unregister device from push notification backend
        try {
            await deleteDevices()
        } catch (e) {
            logger.error('Failed to delete devices', { error: e })
        }

        // 7. Clear PIN and biometrics from secure storage
        await savePin(null)

        // 8. Empty every table on the live connection. We deliberately do NOT
        // close + delete + reopen the database: tearing the native connection
        // down while the sync service (or any other caller) still has a
        // statement in flight frees the sqlite3 handle out from under it and
        // crashes libexpo-sqlite.so with a SIGSEGV. Clearing in place keeps the
        // handle valid; expo-sqlite serializes the deletes behind in-flight work.
        try {
            await clearDatabase()
        } catch (e) {
            logger.error('Failed to clear database', { error: e })
        }

        // 9. Remove legacy (v6) migration data + sentinel so a re-upgrade starts clean
        try {
            await getProvider().migration.resetLegacyData()
        } catch (e) {
            logger.error('Failed to reset legacy migration data', { error: e })
        }

        // 10. Clear all registered stores (this will redirect to onboarding, then show the success popup)
        clearAllStores()

        // 11. Drop the React Query cache last. With the active account gone,
        // address-gated queries are disabled, so removing them can't make
        // React Query recreate and refetch against the now-deleted database.
        if (queryClient) {
            queryClient.removeQueries()
        }
        getProvider().keyValueStorage.removeItem(REACT_QUERY_PERSIST_KEY)
    }, [
        queryClient,
        keys,
        deleteKey,
        savePin,
        deleteDevices,
        deleteAllSessions,
    ])

    return { deleteAllData: wipeAllUserData, wipeAllUserData }
}
