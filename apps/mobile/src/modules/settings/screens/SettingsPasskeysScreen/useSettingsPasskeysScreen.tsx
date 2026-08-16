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

import { useCallback, useEffect, useMemo } from 'react'
import { AppState } from 'react-native'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { isActiveAppState } from '@utils/app-state'
import {
    usePasskeyMigrationBanner,
    type UsePasskeyMigrationBannerResult,
} from '../../components/PasskeyMigrationBanner'
import { openCredentialProviderSettings } from './openCredentialProviderSettings'
import {
    usePasskeyAutofillStatus,
    usePasskeysQuery,
    useRemovePasskeyMutation,
    type Passkey,
} from '@perawallet/wallet-core-passkeys'
import { useBiometricSecurityLevel } from '@perawallet/wallet-core-security'
import { useHasHDWallet } from '@perawallet/wallet-core-accounts'
import { trackEvent, PasskeysEvent } from '@analytics'

export type SettingsPasskeysScreenState =
    | 'loading'
    | 'error'
    | 'disabled'
    | 'empty'
    | 'populated'

/**
 * Which prerequisite notice to surface above the managed-passkey content, or
 * `null` when all prerequisites are met. HD wallet takes precedence over
 * biometric — without a wallet there's nothing to derive a passkey from, so
 * it's the more fundamental gap to surface first.
 */
export type PasskeysNotice = 'hd-wallet' | 'biometric' | null

export type UseSettingsPasskeysScreenResult = {
    state: SettingsPasskeysScreenState
    passkeys: Passkey[]
    /** The prerequisite notice to render (empty / populated states only). */
    notice: PasskeysNotice
    /**
     * Whether a row may offer its remove action. Removal is one-way and a
     * flagged passkey can only be replaced while Pera is the active provider,
     * so removing one with the provider off locks the user out of that site.
     *
     * `passkey.needsMigration` alone does not answer this: it is only readable
     * off a source that has a metadata bag, so a `source: 'native'` row —
     * which is what a credential `repairs/0002` un-adopted comes back as —
     * reports `false` whether or not it is flagged. The migration read is
     * unioned in for exactly those, and a row stays unremovable until that read
     * has answered.
     */
    canRemove: (passkey: Passkey) => boolean
    /**
     * The migration banner's own state. Composed here rather than in the
     * screen body so its two gates are wired from the values they belong to:
     * `isManaging` for whether the banner shows at all, and the raw provider
     * state — not `state === 'disabled'`, which additionally requires an empty
     * list — for whether a replacement passkey could actually be registered.
     */
    migration: UsePasskeyMigrationBannerResult
    /**
     * Whether to offer the QR scanner entry point. Hidden while the screen is
     * still resolving (loading) or errored, when there's no HD wallet to derive
     * from, and when the device has no screen lock (no strong biometric and no
     * device credential) — in each case a scan would just dead-end.
     */
    canScan: boolean
    isScannerVisible: boolean
    onOpenScanner: () => void
    onCloseScanner: () => void
    onRequestDelete: (passkey: Passkey) => void
    onOpenProviderSettings: () => Promise<void>
    onDismissError: () => void
}

export const useSettingsPasskeysScreen =
    (): UseSettingsPasskeysScreenResult => {
        const status = usePasskeyAutofillStatus()
        const list = usePasskeysQuery()
        const biometric = useBiometricSecurityLevel()
        const hasHDWallet = useHasHDWallet()
        const { request } = useBottomSheet()
        const { removePasskey } = useRemovePasskeyMutation()
        const { showError } = useErrorToast()
        const { t } = useLanguage()
        const scanner = useModalState()

        // Re-check provider + biometric status when the app returns to the
        // foreground — covers the user enabling Pera as the credential provider
        // in system settings and coming back. Explicit rather than relying on
        // focus-driven refetching: the biometric check isn't a query, and this
        // must fire even for fresh cache entries.
        const refreshStatus = status.refresh
        const refreshBiometric = biometric.refresh
        useEffect(() => {
            const sub = AppState.addEventListener('change', state => {
                if (isActiveAppState(state)) {
                    refreshStatus()
                    refreshBiometric()
                }
            })
            return () => sub.remove()
        }, [refreshStatus, refreshBiometric])

        const onRequestDelete = useCallback(
            async (passkey: Passkey) => {
                const confirmed = await request<boolean>({
                    contents: (
                        <ConfirmActionContent
                            icon='trash'
                            iconVariant='error'
                            title={t('settings.passkeys.remove_title')}
                            message={t('settings.passkeys.remove_body')}
                            confirmLabel={t('settings.passkeys.remove_confirm')}
                            cancelLabel={t('settings.passkeys.remove_cancel')}
                            confirmVariant='destructive'
                            buttonPaddingStyle='dense'
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (!confirmed) return
                try {
                    await removePasskey(passkey)
                    trackEvent(PasskeysEvent.Deleted)
                } catch (error) {
                    // The sheet has already closed; surface the failure as a
                    // toast so the user knows the passkey is still there.
                    showError(error, t('settings.passkeys.error_title'))
                }
            },
            [request, removePasskey, showError, t],
        )

        const onOpenProviderSettings = useCallback(async () => {
            await openCredentialProviderSettings(status.openProviderSettings)
        }, [status])

        const onDismissError = useCallback(() => {
            list.refetch()
        }, [list])

        const state = resolveState(status, list)
        const lacksDeviceAuthentication =
            !biometric.isLoading && !biometric.hasStrongBiometricOrCredential
        const isManaging = state === 'empty' || state === 'populated'

        const handleRequestDelete = useCallback(
            (passkey: Passkey) => void onRequestDelete(passkey),
            [onRequestDelete],
        )

        const isProviderActive = status.isProviderActive

        const migration = usePasskeyMigrationBanner({
            isManaging,
            isProviderActive,
            onRequestDelete: handleRequestDelete,
        })

        const { affected, isFlagSourceSettled } = migration
        const flaggedKeyIds = useMemo(
            () => new Set(affected.map(passkey => passkey.keyId)),
            [affected],
        )

        const canRemove = useCallback(
            (passkey: Passkey) => {
                if (isProviderActive) return true
                if (!isFlagSourceSettled) return false
                return !(
                    passkey.needsMigration || flaggedKeyIds.has(passkey.keyId)
                )
            },
            [isProviderActive, isFlagSourceSettled, flaggedKeyIds],
        )

        const notice: PasskeysNotice = !isManaging
            ? null
            : !hasHDWallet
              ? 'hd-wallet'
              : lacksDeviceAuthentication
                ? 'biometric'
                : null

        return {
            state,
            passkeys: list.passkeys,
            notice,
            canRemove,
            migration,
            canScan:
                state !== 'loading' &&
                state !== 'error' &&
                hasHDWallet &&
                !lacksDeviceAuthentication,
            isScannerVisible: scanner.isOpen,
            onOpenScanner: scanner.open,
            onCloseScanner: scanner.close,
            onRequestDelete: handleRequestDelete,
            onOpenProviderSettings,
            onDismissError,
        }
    }

const resolveState = (
    status: ReturnType<typeof usePasskeyAutofillStatus>,
    list: ReturnType<typeof usePasskeysQuery>,
): SettingsPasskeysScreenState => {
    if (status.isLoading || list.isLoading) return 'loading'
    if (list.isError) return 'error'
    // Existing passkeys are proof the provider is/was working — never nag to
    // enable it when there are credentials to show.
    if (list.passkeys.length > 0) return 'populated'
    if (!status.isProviderActive) return 'disabled'
    return 'empty'
}
