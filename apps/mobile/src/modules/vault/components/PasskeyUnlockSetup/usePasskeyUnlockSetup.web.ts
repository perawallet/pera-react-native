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
import {
    enablePasskeyUnlock,
    enablePasskeyUnlockWithSession,
    InvalidPasswordError,
    PasskeyPrfUnsupportedError,
    VaultLockedError,
    VaultReauthRequiredError,
} from '@perawallet/wallet-extension-keystore-chrome'
import { logger } from '@perawallet/wallet-core-shared'
import {
    AnalyticsMetadataKey as Key,
    trackEvent,
    VaultEvent,
    type PasskeySetupScreen,
} from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useRequireVaultPassword } from '../../hooks/useRequireVaultPassword'

export type PasskeyUnlockSetupFailure =
    | 'not-saved'
    | 'prf-unsupported'
    | 'unexpected'

export type PasskeyUnlockSetupStatus =
    | 'idle'
    | 'pending'
    | 'enabled'
    | PasskeyUnlockSetupFailure

export const isPasskeySetupFailure = (
    status: PasskeyUnlockSetupStatus,
): status is PasskeyUnlockSetupFailure =>
    status === 'not-saved' ||
    status === 'prf-unsupported' ||
    status === 'unexpected'

// WebAuthn reports a closed prompt, a provider refusal and a client timeout
// all as NotAllowedError, so one state has to cover them and its copy names
// both causes.
const NOT_SAVED_ERROR_NAMES = new Set([
    'NotAllowedError',
    'NotSupportedError',
    'ConstraintError',
])

/** Exported for its table test; the hook is its only runtime caller. */
export const toPasskeySetupFailure = (
    error: unknown,
): PasskeyUnlockSetupFailure => {
    if (error instanceof PasskeyPrfUnsupportedError) return 'prf-unsupported'
    if (error instanceof DOMException && NOT_SAVED_ERROR_NAMES.has(error.name))
        return 'not-saved'
    return 'unexpected'
}

// DOMException is not an Error subclass in every realm (jsdom), so read the
// fields off any error-shaped value rather than relying on instanceof.
const describeError = (
    error: unknown,
): { name: string | undefined; message: string } => {
    if (typeof error === 'object' && error !== null) {
        const { name, message } = error as { name?: unknown; message?: unknown }
        return {
            name: typeof name === 'string' ? name : undefined,
            message: typeof message === 'string' ? message : String(error),
        }
    }
    return { name: undefined, message: String(error) }
}

export type UsePasskeyUnlockSetupParams = {
    screen: PasskeySetupScreen
    onEnabled?: () => void
    /** Replaces the password sheet where one cannot present (the prompt). */
    onReauthRequired?: () => void
}

export type UsePasskeyUnlockSetupResult = {
    status: PasskeyUnlockSetupStatus
    enableWithSession: () => Promise<void>
    /** Rethrows InvalidPasswordError; every other failure lands in `status`. */
    enableWithPassword: (password: string) => Promise<void>
    recordSkip: () => void
}

export const usePasskeyUnlockSetup = ({
    screen,
    onEnabled,
    onReauthRequired,
}: UsePasskeyUnlockSetupParams): UsePasskeyUnlockSetupResult => {
    const [status, setStatusState] = useState<PasskeyUnlockSetupStatus>('idle')
    // The latest status, so a second tap during the ceremony is refused even
    // before React re-renders with 'pending'.
    const statusRef = useRef<PasskeyUnlockSetupStatus>('idle')
    const hasTrackedViewRef = useRef(false)
    const { requireVaultPassword } = useRequireVaultPassword()
    const { t } = useLanguage()

    const setStatus = useCallback((next: PasskeyUnlockSetupStatus): void => {
        statusRef.current = next
        setStatusState(next)
    }, [])

    useEffect(() => {
        if (screen === 'settings' || hasTrackedViewRef.current) return
        hasTrackedViewRef.current = true
        trackEvent(VaultEvent.PasskeyOfferView, { [Key.ScreenName]: screen })
    }, [screen])

    // The warn log is what tells, on a store build, which DOMException each
    // passkey provider (1Password, iCloud Keychain) produces when it refuses.
    const fail = useCallback(
        (error: unknown): void => {
            const next = toPasskeySetupFailure(error)
            const { name, message } = describeError(error)
            logger.warn('Passkey unlock setup failed', {
                status: next,
                name,
                message,
            })
            if (next === 'unexpected') {
                logger.error('Enable passkey unlock failed', { error })
            }
            trackEvent(VaultEvent.PasskeyEnableFail, {
                [Key.ScreenName]: screen,
                [Key.ErrorCause]: name ? `${next}:${name}` : next,
            })
            setStatus(next)
        },
        [screen, setStatus],
    )

    const succeed = useCallback((): void => {
        setStatus('enabled')
        trackEvent(VaultEvent.PasskeyEnableSuccess, {
            [Key.ScreenName]: screen,
        })
        onEnabled?.()
    }, [screen, setStatus, onEnabled])

    const enableWithSession = useCallback(async (): Promise<void> => {
        if (statusRef.current === 'pending') return
        setStatus('pending')
        try {
            await enablePasskeyUnlockWithSession()
        } catch (error) {
            if (error instanceof VaultLockedError) {
                setStatus('idle')
                return
            }
            if (!(error instanceof VaultReauthRequiredError)) {
                fail(error)
                return
            }
            if (onReauthRequired) {
                onReauthRequired()
                setStatus('idle')
                return
            }
            const isVerified = await requireVaultPassword(
                t('vault.passkey_setup.reauth_description'),
            )
            if (!isVerified) {
                setStatus('idle')
                return
            }
            try {
                await enablePasskeyUnlockWithSession()
            } catch (retryError) {
                fail(retryError)
                return
            }
        }
        succeed()
    }, [setStatus, fail, succeed, onReauthRequired, requireVaultPassword, t])

    const enableWithPassword = useCallback(
        async (password: string): Promise<void> => {
            if (statusRef.current === 'pending') return
            setStatus('pending')
            try {
                await enablePasskeyUnlock(password)
            } catch (error) {
                if (error instanceof InvalidPasswordError) {
                    setStatus('idle')
                    throw error
                }
                fail(error)
                return
            }
            succeed()
        },
        [setStatus, fail, succeed],
    )

    const recordSkip = useCallback((): void => {
        trackEvent(VaultEvent.PasskeyOfferSkip, { [Key.ScreenName]: screen })
    }, [screen])

    return { status, enableWithSession, enableWithPassword, recordSkip }
}
