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

import { useEffect, useRef } from 'react'
import {
    decryptPeraWebBackupPayload,
    fetchPeraWebBackup,
    PeraWebImportError,
    PeraWebImportErrorReason,
    usePeraWebAccountImport,
} from '@perawallet/wallet-core-backup'
import { DuplicateAccountError } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
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

            // 3. Import every account.
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
                }
            }

            if (cancelled) return
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

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [network])
}
