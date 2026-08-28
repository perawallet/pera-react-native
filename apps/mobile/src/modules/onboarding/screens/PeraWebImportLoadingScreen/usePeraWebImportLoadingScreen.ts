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

import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import {
    decryptPeraWebBackupPayload,
    fetchPeraWebBackup,
    PeraWebImportError,
    PeraWebImportErrorReason,
    usePeraWebAccountImport,
} from '@perawallet/wallet-core-backup'
import { DuplicateAccountError } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks'

/**
 * Drives the fetch → decrypt → import pipeline on screen mount. Owns the
 * error toast / navigation logic so the screen itself is purely
 * presentational.
 *
 * Failure modes:
 *   - QR cleared / missing       → bounce back to options
 *   - Fetch fails                → `NetworkFailed` toast + back to info
 *   - Decryption fails           → typed `PeraWebImportError` toast + back
 *   - Per-account import errors  → counted as `failed`, surfaced on the
 *                                  result screen rather than blocking
 */
export const usePeraWebImportLoadingScreen = (): void => {
    const navigation = useAppNavigation()
    const { errorToast } = useToast()
    const { t } = useLanguage()
    const { network } = useNetwork()
    const { importAccount } = usePeraWebAccountImport()
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

    const startedRef = useRef(false)

    useEffect(() => {
        if (startedRef.current) return
        startedRef.current = true

        let cancelled = false

        const run = async () => {
            const qr = usePeraWebImportFlowStore.getState().qr
            if (!qr) {
                navigationRef.current.goBack()
                return
            }

            // The deeplink handler jumps here straight from a QR scan,
            // bypassing the disabled menu row on the options screen, so
            // the network needs its own check here too.
            if (!isPeraBackedNetwork(network)) {
                errorToastRef.current(
                    tRef.current('common.network_unavailable.title'),
                    tRef.current('common.network_unavailable.body'),
                )
                navigationRef.current.goBack()
                return
            }

            // 1. Fetch the encrypted backup from the Pera mobile API.
            let response
            try {
                response = await fetchPeraWebBackup(network, qr.backupId)
            } catch (error) {
                if (cancelled) return
                logger.error('Pera Web backup fetch failed', { error })
                // guardrails-ignore-next-line no-error-toast-in-catch reason: surfaced as typed PeraWebImportError to user
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

            // 2. Decrypt + decode the payload.
            let payload
            try {
                payload = decryptPeraWebBackupPayload(
                    response,
                    qr.encryptionKey,
                )
            } catch (error) {
                if (cancelled) return
                logger.error('Pera Web payload decrypt failed', { error })
                const reason =
                    error instanceof PeraWebImportError
                        ? error.reason
                        : PeraWebImportErrorReason.DecryptionFailed
                // guardrails-ignore-next-line no-error-toast-in-catch reason: typed reason mapped to localized string
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

            if (cancelled) return
            setPayloadRef.current(payload)

            // 3. Import every account. Each account's raw 32-byte seed is
            // wiped as soon as the import returns (or fails non-fatally)
            // so the in-memory window is bounded by a single iteration
            // rather than the lifetime of the result screen.
            let imported = 0
            let skipped = 0
            let failed = 0
            for (const account of payload.accounts) {
                if (cancelled) return
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

            if (cancelled) return
            // Wipe the QR encryption key and any residual state before
            // navigating. The result screen only needs aggregate counts
            // (passed via route params), so no decrypted material needs
            // to outlive this point in the flow.
            resetRef.current()
            navigationRef.current.replace('PeraWebImportResult', {
                importedCount: imported,
                skippedDuplicateCount: skipped,
                failedCount: failed,
            })
        }

        run().catch(error => {
            // Catch-all for anything escaping the typed branches above.
            // Don't leave the user stuck on the loader.
            logger.error('Pera Web import pipeline crashed', { error })
            errorToastRef.current(
                tRef.current(
                    'onboarding.pera_web_import.loading.decrypt_failed_title',
                ),
                tRef.current(
                    `onboarding.pera_web_import.errors.${PeraWebImportErrorReason.DecryptionFailed}` as never,
                ),
            )
            resetRef.current()
            navigationRef.current.goBack()
        })

        // If the user backgrounds the app mid-flow (Android can keep RN
        // alive for minutes-to-hours), a heap snapshot would otherwise
        // catch every decrypted seed live in the store. On the first
        // non-`active` transition both cancel the loop (so the next
        // iteration short-circuits before reading a now-wiped buffer)
        // and reset the store (which zeros the seed bytes in place). The
        // in-flight `importAccount` call still operates on its own
        // `.slice(0,32)` copy and finishes cleanly.
        const appStateSub = AppState.addEventListener('change', state => {
            if (state !== 'active') {
                cancelled = true
                resetRef.current()
            }
        })

        return () => {
            cancelled = true
            appStateSub.remove()
            // Cancel-path safety net: if the screen unmounts before the
            // run() resolves to `navigation.replace` (system back,
            // navigator preemption, force-quit recovery), wipe whatever
            // the store is still holding. After a successful run() this
            // is a no-op since the state is already at `initialState`.
            resetRef.current()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [network])
}
