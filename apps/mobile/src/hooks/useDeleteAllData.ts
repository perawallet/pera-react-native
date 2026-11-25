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
import {
    getActiveConnectionRegistry,
    useOptionalConnectionRegistry,
} from '@perawallet/wallet-core-connections'
import { clearDatabase } from '@perawallet/wallet-core-database'
import { useDeleteDeviceMutation } from '@perawallet/wallet-core-device'
import { useKMS } from '@perawallet/wallet-core-kms'
import {
    isStoreDisabledError,
    withPasskeyAutofillPaused,
} from '@perawallet/wallet-core-passkeys'
import { usePinCode } from '@perawallet/wallet-core-security'
import {
    clearAllStores,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    clearWalletConnectV2Storage,
    LEGACY_IMPORTED_IDS_KEY,
    LEGACY_STORE_KEY,
} from '@perawallet/wallet-core-walletconnect'
import {
    getProvider,
    clearKeystore,
} from '@perawallet/wallet-extension-provider'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { destroyVault } from './destroyVault'
import { useWipeRecoveryStore } from './useWipeRecoveryStore'

const REACT_QUERY_PERSIST_KEY = 'reactQuery'
const WIPE_IN_PROGRESS_KEY = 'wipe-in-progress'

/** What a wipe was for: a duress wipe ends on a decoy wallet, not onboarding. */
export type WipeKind = 'delete-all' | 'duress'

/**
 * The wipe a killed process left unfinished, if any. The keystore (PIN record
 * included) goes first and the persisted accounts last, so an unfinished wipe
 * would otherwise relaunch unlocked over the accounts it was deleting.
 */
export const readPendingWipe = (): Nullable<WipeKind> => {
    const value = getProvider().keyValueStorage.getItem(WIPE_IN_PROGRESS_KEY)
    if (value === null) return null
    // Anything unrecognised still resumes, as the wipe that keeps no data.
    return value === 'duress' ? 'duress' : 'delete-all'
}

export const clearPendingWipe = (): void => {
    const storage = getProvider().keyValueStorage
    storage.removeItem(WIPE_IN_PROGRESS_KEY)
    useWipeRecoveryStore.setState(false)
    try {
        storage.trim?.()
    } catch (error) {
        logger.warn('Unable to compact storage after the wipe', { error })
    }
}

export const clearAccountsStore = () => {
    useAccountsStore.persist.clearStorage()
    useAccountsStore.getState().resetState()
}

type UseDeleteAllDataResult = {
    deleteAllData: () => Promise<void>
    /**
     * The same destructive sequence without the settings-flow modal coupling,
     * for the duress wipe. The caller owns any post-wipe routing. A `duress`
     * wipe leaves the pending-wipe marker for the caller to clear once the
     * decoy exists. A failed wipe leaves the marker for the next launch.
     */
    wipeAllUserData: (kind?: WipeKind) => Promise<void>
    /** Completes a pending wipe, if any, without provisioning a decoy. */
    finishPendingWipe: () => Promise<void>
}

export const useDeleteAllData = (): UseDeleteAllDataResult => {
    const { keys, deleteKey } = useKMS()
    const queryClient = useQueryClient()
    const { mutateAsync: deleteDevices } = useDeleteDeviceMutation()
    const { savePin } = usePinCode()
    // Non-throwing: `AutoLockGuard`'s duress path runs above
    // `ConnectionsProvider`; step 5 falls back to the published registry.
    const contextRegistry = useOptionalConnectionRegistry()

    const runWipe = useCallback(async () => {
        // Only steps whose leftovers could reopen the wallet fail the wipe and
        // keep the marker; a persistent failure anywhere else would otherwise
        // hold the app on the recovery screen for good.
        const localFailures: unknown[] = []

        // 1. Abort in-flight queries before we destroy their data sources.
        // Cancellation reverts silently, so — unlike a failed refetch — it
        // never reaches the QueryCache error handler.
        if (queryClient) {
            await queryClient.cancelQueries()
        }

        await withPasskeyAutofillPaused(async () => {
            // 2. Keystore mutations publish updates that otherwise re-bootstrap
            // the native credential provider while its wallet is being wiped.
            if (keys) {
                await Promise.allSettled(
                    Array.from(keys.values()).map(async k => {
                        if (k.id) {
                            await deleteKey(k.id)
                        }
                    }),
                )
            }

            // 3. Bulk-clear the keystore, including orphaned records, and
            // destroy its master key.
            try {
                await clearKeystore()
            } catch (e) {
                localFailures.push(e)
                logger.error('Failed to clear keystore', { error: e })
            }

            // 4. The credential provider's native copy has independent storage.
            try {
                await getProvider().passkeyAutofill.clearCredentials()
            } catch (e) {
                // On iOS the final identity-store sync may reject after cleanup.
                if (isStoreDisabledError(e)) {
                    logger.warn(
                        'AutoFill identity store disabled; native passkey state cleared without identity sync',
                    )
                } else {
                    logger.error(
                        'Failed to clear native passkey autofill state',
                        { error: e },
                    )
                }
            }
        })

        // 5. Notify peers, then drop their records. Read at wipe time: the provider
        // may not have mounted when `AutoLockGuard` first rendered. `clear()` is
        // the backstop; these records are not in `clearAllStores`.
        const registry = contextRegistry ?? getActiveConnectionRegistry()
        if (registry) {
            try {
                await registry.disconnectAll()
            } catch (e) {
                logger.error('Failed to disconnect registry connections', {
                    error: e,
                })
            }
        }

        try {
            await getProvider().connections.store.clear()
        } catch (e) {
            logger.error('Failed to clear stored connections', { error: e })
        }

        // The pre-registry blob holds plaintext session keys and is removed
        // only by a fully clean import pass, so an import that never completed
        // would otherwise survive the wipe and re-import on the next launch.
        try {
            getProvider().keyValueStorage.removeItem(LEGACY_STORE_KEY)
            getProvider().keyValueStorage.removeItem(LEGACY_IMPORTED_IDS_KEY)
        } catch (e) {
            logger.error('Failed to remove the legacy WalletConnect store', {
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
        try {
            await savePin(null)
        } catch (e) {
            localFailures.push(e)
            logger.error('Failed to clear the PIN record', { error: e })
        }

        // 8. Empty every table in place; never close + delete + reopen. Tearing the
        // connection down while the sync service has a statement in flight frees
        // the sqlite3 handle under it and SIGSEGVs libexpo-sqlite.so.
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
        try {
            clearAllStores()
        } catch (e) {
            localFailures.push(e)
            logger.error('Failed to clear persisted wallet stores', {
                error: e,
            })
        }

        // 11. Drop the React Query cache last. With the active account gone,
        // address-gated queries are disabled, so removing them can't make
        // React Query recreate and refetch against the now-deleted database.
        try {
            queryClient?.removeQueries()
            getProvider().keyValueStorage.removeItem(REACT_QUERY_PERSIST_KEY)
        } catch (e) {
            logger.error('Failed to clear the query cache', { error: e })
        }

        // 12. WalletKit's keychain: no disconnect clears the client seed or an
        // unsettled pairing's symKey. Last, because `clearAllStores` above is
        // what tears the v2 handler down, and a live client mutating after an
        // earlier clear writes its in-memory keychain straight back.
        try {
            clearWalletConnectV2Storage(getProvider().keyValueStorage)
        } catch (e) {
            logger.error('Failed to clear the WalletConnect v2 storage', {
                error: e,
            })
        }

        // 13. Extension only: destroy the password vault so the next wallet
        // gets a fresh master key. Last, because earlier steps may still open
        // sealed material; the shell then routes to CreatePasswordScreen.
        try {
            await destroyVault()
        } catch (e) {
            localFailures.push(e)
            logger.error('Failed to destroy the vault', { error: e })
        }

        // Finish the independent cleanups before leaving the marker for retry.
        if (localFailures.length > 0) {
            throw new AggregateError(
                localFailures,
                'Some wallet data could not be cleared',
            )
        }
    }, [queryClient, keys, deleteKey, savePin, deleteDevices, contextRegistry])

    const wipeAllUserData = useCallback(
        async (kind: WipeKind = 'delete-all') => {
            // Before anything is destroyed, so a kill at any later step
            // relaunches into the rest of the wipe (see `readPendingWipe`).
            getProvider().keyValueStorage.setItem(WIPE_IN_PROGRESS_KEY, kind)
            try {
                await runWipe()
                if (kind !== 'duress') clearPendingWipe()
            } catch (error) {
                // Under duress a recovery screen would show the coercer that
                // something was wiped; the marker alone finishes it next launch.
                if (kind !== 'duress') useWipeRecoveryStore.setState(true)
                clearAccountsStore()
                throw error
            }
        },
        [runWipe],
    )

    const finishPendingWipe = useCallback(async () => {
        const pending = readPendingWipe()
        if (pending === null) return
        await wipeAllUserData(pending)
        clearPendingWipe()
    }, [wipeAllUserData])

    return {
        deleteAllData: wipeAllUserData,
        wipeAllUserData,
        finishPendingWipe,
    }
}
