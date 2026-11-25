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

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import {
    decryptPeraWebBackupPayload,
    fetchPeraWebBackup,
    PeraWebImportError,
    PeraWebImportErrorReason,
    usePeraWebAccountImport,
} from '@perawallet/wallet-core-backup'
import { DuplicateAccountError } from '@perawallet/wallet-core-accounts'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks'

export type PeraWebImportReviewAccount = {
    address: string
    name: Nullable<string>
}

type UsePeraWebImportLoadingScreenResult = {
    /** `null` until the backup is fetched and decrypted. */
    reviewAccounts: Nullable<PeraWebImportReviewAccount[]>
    isImporting: boolean
    handleConfirm: () => void
    handleCancel: () => void
}

/**
 * Fetches and decrypts on mount, then holds the accounts for review: a scanned
 * or pasted code only proves some code arrived, so nothing is imported until
 * the user confirms the listed addresses.
 *
 * Failure modes:
 *   - QR cleared / missing       → bounce back to options
 *   - Fetch fails                → `NetworkFailed` toast + back to info
 *   - Decryption fails           → typed `PeraWebImportError` toast + back
 *   - Per-account import errors  → counted as `failed`, surfaced on the
 *                                  result screen rather than blocking
 */
export const usePeraWebImportLoadingScreen =
    (): UsePeraWebImportLoadingScreenResult => {
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { t } = useLanguage()
        const deployment = useWalletDeployment()
        const canImportPeraWeb = useCapability({ anyChain: 'peraWebImport' })
        const { importAccount } = usePeraWebAccountImport(ALGORAND_CHAIN_ID)
        const setPayload = usePeraWebImportFlowStore(state => state.setPayload)
        const reset = usePeraWebImportFlowStore(state => state.reset)

        const navigationRef = useRef(navigation)
        navigationRef.current = navigation
        const errorToastRef = useRef(errorToast)
        errorToastRef.current = errorToast
        const tRef = useRef(t)
        tRef.current = t
        const importAccountRef = useRef(importAccount)
        importAccountRef.current = importAccount
        const setPayloadRef = useRef(setPayload)
        setPayloadRef.current = setPayload
        const resetRef = useRef(reset)
        resetRef.current = reset
        const canImportPeraWebRef = useRef(canImportPeraWeb)
        canImportPeraWebRef.current = canImportPeraWeb

        const [reviewAccounts, setReviewAccounts] =
            useState<Nullable<PeraWebImportReviewAccount[]>>(null)
        const [isImporting, setIsImporting] = useState(false)
        const startedRef = useRef(false)
        const importStartedRef = useRef(false)
        // Shared by the import loop and the AppState handler so a background
        // mid-flight breaks the loop before it reads a now-wiped key.
        const cancelledRef = useRef(false)
        const unmountedRef = useRef(false)

        const cancelImport = useCallback((): boolean => {
            if (cancelledRef.current) return false
            cancelledRef.current = true
            resetRef.current()
            setReviewAccounts(null)
            setIsImporting(false)
            return true
        }, [])

        const leaveImport = useCallback(() => {
            if (cancelImport()) navigationRef.current.goBack()
        }, [cancelImport])

        const failPipeline = useCallback(
            (error: unknown) => {
                if (cancelledRef.current) return
                // Catch-all for anything escaping the typed branches. Don't leave
                // the user stuck on the loader.
                logger.error('Pera Web import pipeline crashed', { error })
                errorToastRef.current(
                    tRef.current(
                        'onboarding.pera_web_import.loading.decrypt_failed_title',
                    ),
                    tRef.current(
                        `onboarding.pera_web_import.errors.${PeraWebImportErrorReason.DecryptionFailed}` as never,
                    ),
                )
                leaveImport()
            },
            [leaveImport],
        )

        // Each account's raw seed is wiped as soon as its import returns (or
        // fails non-fatally), so the in-memory window is one iteration rather
        // than the lifetime of the result screen.
        const importAll = useCallback(async () => {
            const accounts =
                usePeraWebImportFlowStore.getState().payload?.accounts ?? []
            let imported = 0
            let skipped = 0
            let failed = 0
            for (const [index, account] of accounts.entries()) {
                // Backgrounded mid-import: the store reset wiped the rest.
                if (cancelledRef.current) {
                    failed += accounts.length - index
                    break
                }
                try {
                    await importAccountRef.current(account)
                    imported++
                } catch (error) {
                    if (error instanceof DuplicateAccountError) {
                        skipped++
                    } else {
                        logger.error('Pera Web account import failed', {
                            address: account.address,
                            error,
                        })
                        failed++
                    }
                } finally {
                    zeroBytes(account.privateKey)
                    account.privateKey = null
                }
            }

            if (unmountedRef.current) return
            // The result screen only needs the counts (route params), so no
            // decrypted material outlives this point.
            resetRef.current()
            navigationRef.current.replace('PeraWebImportResult', {
                importedCount: imported,
                skippedDuplicateCount: skipped,
                failedCount: failed,
            })
        }, [])

        const handleConfirm = useCallback(() => {
            if (
                cancelledRef.current ||
                importStartedRef.current ||
                !usePeraWebImportFlowStore.getState().payload
            )
                return
            importStartedRef.current = true
            setIsImporting(true)
            void importAll().catch(failPipeline)
        }, [importAll, failPipeline])

        const handleCancel = useCallback(() => {
            if (!importStartedRef.current) leaveImport()
        }, [leaveImport])

        useEffect(() => {
            if (startedRef.current) return
            startedRef.current = true

            const run = async () => {
                const qr = usePeraWebImportFlowStore.getState().qr
                if (!qr) {
                    navigationRef.current.goBack()
                    return
                }

                // A stale navigation can still land here after the capability
                // went off, so the screen refuses on its own too.
                if (!canImportPeraWebRef.current) {
                    errorToastRef.current(
                        tRef.current('common.network_unavailable.title'),
                        tRef.current('common.network_unavailable.generic_body'),
                    )
                    navigationRef.current.goBack()
                    return
                }

                // 1. Fetch the encrypted backup from the Pera mobile API.
                let response
                try {
                    response = await fetchPeraWebBackup(deployment, qr.backupId)
                } catch (error) {
                    if (cancelledRef.current) return
                    logger.error('Pera Web backup fetch failed', { error })
                    errorToastRef.current(
                        tRef.current(
                            'onboarding.pera_web_import.loading.fetch_failed_title',
                        ),
                        tRef.current(
                            `onboarding.pera_web_import.errors.${PeraWebImportErrorReason.NetworkFailed}` as never,
                        ),
                    )
                    navigationRef.current.goBack()
                    return
                }

                if (cancelledRef.current) return

                // 2. Decrypt + decode the payload.
                let payload
                try {
                    payload = decryptPeraWebBackupPayload(
                        response,
                        qr.encryptionKey,
                        ALGORAND_CHAIN_ID,
                    )
                } catch (error) {
                    if (cancelledRef.current) return
                    logger.error('Pera Web payload decrypt failed', { error })
                    const reason =
                        error instanceof PeraWebImportError
                            ? error.reason
                            : PeraWebImportErrorReason.DecryptionFailed
                    errorToastRef.current(
                        tRef.current(
                            'onboarding.pera_web_import.loading.decrypt_failed_title',
                        ),
                        tRef.current(
                            `onboarding.pera_web_import.errors.${reason}` as never,
                        ),
                    )
                    navigationRef.current.goBack()
                    return
                }

                if (cancelledRef.current) return
                setPayloadRef.current(payload)
                setReviewAccounts(
                    payload.accounts.map(({ address, name }) => ({
                        address,
                        name,
                    })),
                )
            }

            void run().catch(failPipeline)

            // If the user backgrounds the app mid-flow (Android can keep RN
            // alive for minutes-to-hours), a heap snapshot would otherwise
            // catch every decrypted seed live in the store. On the first
            // non-`active` transition both cancel the loop (so the next
            // iteration short-circuits before reading a now-wiped buffer)
            // and reset the store (which zeros the seed bytes in place). The
            // in-flight `importAccount` call still operates on its own
            // `.slice(0,32)` copy and finishes cleanly.
            let didInterrupt = false
            const appStateSub = AppState.addEventListener('change', state => {
                if (state !== 'active') {
                    // A started import reports its own outcome.
                    if (cancelImport() && !importStartedRef.current) {
                        didInterrupt = true
                    }
                    return
                }
                if (!didInterrupt) return
                didInterrupt = false
                errorToastRef.current(
                    tRef.current('common.error.title'),
                    tRef.current(
                        'onboarding.pera_web_import.review.interrupted',
                    ),
                )
                navigationRef.current.goBack()
            })

            return () => {
                unmountedRef.current = true
                cancelledRef.current = true
                appStateSub.remove()
                // Cancel-path safety net: if the screen unmounts before the
                // run() resolves to `navigation.replace` (system back,
                // navigator preemption, force-quit recovery), wipe whatever
                // the store is still holding. After a successful run() this
                // is a no-op since the state is already at `initialState`.
                resetRef.current()
            }
        }, [deployment, cancelImport, failPipeline])

        return { reviewAccounts, isImporting, handleConfirm, handleCancel }
    }
