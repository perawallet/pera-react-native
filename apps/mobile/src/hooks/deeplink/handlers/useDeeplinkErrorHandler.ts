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

import { useCallback } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { DEEPLINK_TIMEOUT_TAG } from './timeout'

type Variant =
    | 'generic'
    | 'walletconnect'
    | 'walletconnect_unsupported'
    | 'keyreg'
    | 'keyreg-unknown-account'
    | 'recover'
    | 'recover_duplicate'
    | 'timeout'

export type ShowDeeplinkErrorParams = {
    variant: Variant
    parsedType?: string
    error?: unknown
}

export type ShowDeeplinkError = (params: ShowDeeplinkErrorParams) => void

const MESSAGE_KEYS: Record<Variant, { title: string; body: string }> = {
    generic: {
        title: 'deeplink.error.title_generic',
        body: 'deeplink.error.body_generic',
    },
    walletconnect: {
        title: 'deeplink.error.title_walletconnect',
        body: 'deeplink.error.body_walletconnect',
    },
    walletconnect_unsupported: {
        title: 'deeplink.error.title_wc_unsupported',
        body: 'deeplink.error.body_wc_unsupported',
    },
    keyreg: {
        title: 'deeplink.error.title_keyreg',
        body: 'deeplink.error.body_keyreg',
    },
    'keyreg-unknown-account': {
        title: 'deeplink.error.title_keyreg',
        body: 'deeplink.error.body_keyreg_unknown_account',
    },
    recover: {
        title: 'deeplink.error.title_recover',
        body: 'deeplink.error.body_recover',
    },
    recover_duplicate: {
        title: 'deeplink.error.title_recover',
        body: 'deeplink.error.body_recover_duplicate',
    },
    timeout: {
        title: 'deeplink.error.title_timeout',
        body: 'deeplink.error.body_timeout',
    },
}

/**
 * Surfaces a deeplink failure to the user via the in-app toast notifier.
 *
 * Stacking caveat: react-native-notifier renders into a `NotifierRoot` in
 * the React tree, so any toast fired while the QR scanner's RN `Modal`
 * is still open is obscured by the Modal's native window. Defer the
 * toast by a tick so the Modal close animation completes first — by then
 * the dispatcher's `onSuccess` / `onError` callback has already
 * triggered `props.onClose` on the scanner, the Modal is dismissing,
 * and the toast lands on the screen the user came from.
 */
const TOAST_DEFER_MS = 400

export const useDeeplinkErrorHandler = (): ShowDeeplinkError => {
    const { t } = useLanguage()
    const { errorToast } = useToast()

    return useCallback(
        ({ variant, error }) => {
            const isTimeout =
                error instanceof Error &&
                'tag' in error &&
                (error as { tag?: string }).tag === DEEPLINK_TIMEOUT_TAG
            const effectiveVariant: Variant = isTimeout ? 'timeout' : variant
            const { title, body } = MESSAGE_KEYS[effectiveVariant]

            setTimeout(() => {
                errorToast(t(title), t(body))
            }, TOAST_DEFER_MS)
        },
        [errorToast, t],
    )
}
