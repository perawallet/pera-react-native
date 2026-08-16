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

import { useCallback, useEffect } from 'react'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { UserPreferences } from '@constants/user-preferences'
import {
    usePasskeysQuery,
    useRemovePasskeyMutation,
    type Passkey,
} from '@perawallet/wallet-core-passkeys'
import { useBiometricSecurityLevel } from '@perawallet/wallet-core-security'
import { useHasHDWallet } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { trackEvent, PasskeysEvent } from '@analytics'

// Mirrors the native hook's state/notice unions (kept as a separate literal
// type here, not imported from the sibling `useSettingsPasskeysScreen` file
// — a bare relative import of that name would resolve to *this* file under
// Metro's web platform extension resolution).
export type SettingsPasskeysScreenState =
    | 'loading'
    | 'error'
    | 'disabled'
    | 'empty'
    | 'populated'

export type PasskeysNotice = 'hd-wallet' | 'biometric' | null

export type UseSettingsPasskeysScreenResult = {
    state: SettingsPasskeysScreenState
    passkeys: Passkey[]
    notice: PasskeysNotice
    /**
     * Whether a row may offer its remove action. Same shape as native's gate,
     * against web's own prerequisite for re-registering: the interception
     * toggle sits above the list and is one tap away, where native needs a trip
     * to OS settings.
     *
     * Defence in depth only — `needsMigration` is never `true` here. The
     * marker is written solely by `react-native-keystore`'s
     * `migrations/0001-flag-legacy-passkeys`, and on web Metro resolves that
     * package to `extensions/keystore-chrome` while the engine comes from
     * `@algorandfoundation/keystore-web`; neither carries the migration. Web
     * also has no flat provider records, so there is no second source to union
     * in either.
     */
    canRemove: (passkey: Passkey) => boolean
    canScan: boolean
    isScannerVisible: boolean
    onOpenScanner: () => void
    onCloseScanner: () => void
    onRequestDelete: (passkey: Passkey) => void
    onDismissError: () => void
    /** Master WebAuthn-interception toggle — web has no OS credential-provider
     * concept, so this (not native's `isProviderActive`) is what "active"
     * means here. */
    isInterceptionEnabled: boolean
    onToggleInterception: (enabled: boolean) => void
}

// Web/extension variant: there's no native credential-provider status to poll
// (react-native-passkey-autofill is a no-op web shim), so "active" is derived
// from the `webauthnInterceptionEnabled` settings-store preference — the same
// preference the ISOLATED relay content script
// (apps/browser/src/content/webauthn-toggle.ts) reads once per page load to
// gate interception. Passkey listing/removal still work identically (both
// read the keystore projection), so those are unchanged from the native hook.
export const useSettingsPasskeysScreen =
    (): UseSettingsPasskeysScreenResult => {
        const list = usePasskeysQuery()
        const biometric = useBiometricSecurityLevel()
        const hasHDWallet = useHasHDWallet()
        const { request } = useBottomSheet()
        const { removePasskey } = useRemovePasskeyMutation()
        const { showError } = useErrorToast()
        const { t } = useLanguage()
        const scanner = useModalState()
        const { getPreference, setPreference } = usePreferences()

        // Native refreshes on an AppState 'active' transition; the browser's
        // equivalent is the document becoming visible again. Without it, a
        // user who enables a screen lock in another tab (or another window)
        // keeps seeing the stale "biometric required" notice until they
        // manually reload the popup.
        const refreshBiometric = biometric.refresh
        useEffect(() => {
            const onVisible = (): void => {
                if (document.visibilityState === 'visible') refreshBiometric()
            }
            document.addEventListener('visibilitychange', onVisible)
            return () =>
                document.removeEventListener('visibilitychange', onVisible)
        }, [refreshBiometric])

        const isInterceptionEnabled =
            getPreference(UserPreferences.webauthnInterceptionEnabled) === true

        const onToggleInterception = useCallback(
            (enabled: boolean) => {
                setPreference(
                    UserPreferences.webauthnInterceptionEnabled,
                    enabled,
                )
            },
            [setPreference],
        )

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

        const onDismissError = useCallback(() => {
            list.refetch()
        }, [list])

        const canRemove = useCallback(
            (passkey: Passkey) =>
                isInterceptionEnabled || !passkey.needsMigration,
            [isInterceptionEnabled],
        )

        const state = resolveState(isInterceptionEnabled, list)
        const lacksDeviceAuthentication =
            !biometric.isLoading && !biometric.hasStrongBiometricOrCredential
        const isManaging = state === 'empty' || state === 'populated'

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
            canScan:
                state !== 'loading' &&
                state !== 'error' &&
                hasHDWallet &&
                !lacksDeviceAuthentication,
            isScannerVisible: scanner.isOpen,
            onOpenScanner: scanner.open,
            onCloseScanner: scanner.close,
            onRequestDelete: (passkey: Passkey) =>
                void onRequestDelete(passkey),
            onDismissError,
            isInterceptionEnabled,
            onToggleInterception,
        }
    }

const resolveState = (
    isInterceptionEnabled: boolean,
    list: ReturnType<typeof usePasskeysQuery>,
): SettingsPasskeysScreenState => {
    if (list.isLoading) return 'loading'
    if (list.isError) return 'error'
    // Existing passkeys are proof interception worked at some point — never
    // nag to enable the toggle when there are credentials to show.
    if (list.passkeys.length > 0) return 'populated'
    if (!isInterceptionEnabled) return 'disabled'
    return 'empty'
}
