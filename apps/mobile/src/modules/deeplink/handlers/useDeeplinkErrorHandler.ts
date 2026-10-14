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
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'

type Variant =
    | 'generic'
    | 'walletconnect'
    | 'walletconnect_timeout'
    | 'walletconnect_unsupported'
    | 'keyreg'
    | 'keyreg-unknown-account'
    | 'keyreg-cannot-sign'
    | 'keyreg-network-mismatch'
    | 'recover'
    | 'recover_duplicate'
    | 'timeout'

export type ShowDeeplinkErrorParams = {
    variant: Variant
    parsedType?: string
    error?: unknown
}

export type ShowDeeplinkError = (params: ShowDeeplinkErrorParams) => void

const MESSAGE_KEYS: Record<Variant, { title: I18nKey; body: I18nKey }> = {
    generic: {
        title: i18nKey('deeplink.error.title_generic'),
        body: i18nKey('deeplink.error.body_generic'),
    },
    walletconnect: {
        title: i18nKey('deeplink.error.title_walletconnect'),
        body: i18nKey('deeplink.error.body_walletconnect'),
    },
    walletconnect_timeout: {
        title: i18nKey('deeplink.error.title_walletconnect'),
        body: i18nKey('deeplink.error.body_walletconnect_timeout'),
    },
    walletconnect_unsupported: {
        title: i18nKey('deeplink.error.title_wc_unsupported'),
        body: i18nKey('deeplink.error.body_wc_unsupported'),
    },
    keyreg: {
        title: i18nKey('deeplink.error.title_keyreg'),
        body: i18nKey('deeplink.error.body_keyreg'),
    },
    'keyreg-unknown-account': {
        title: i18nKey('deeplink.error.title_keyreg'),
        body: i18nKey('deeplink.error.body_keyreg_unknown_account'),
    },
    'keyreg-cannot-sign': {
        title: i18nKey('deeplink.error.title_keyreg'),
        body: i18nKey('deeplink.error.body_keyreg_cannot_sign'),
    },
    'keyreg-network-mismatch': {
        title: i18nKey('deeplink.error.title_keyreg'),
        body: i18nKey('deeplink.error.body_keyreg_network_mismatch'),
    },
    recover: {
        title: i18nKey('deeplink.error.title_recover'),
        body: i18nKey('deeplink.error.body_recover'),
    },
    recover_duplicate: {
        title: i18nKey('deeplink.error.title_recover'),
        body: i18nKey('deeplink.error.body_recover_duplicate'),
    },
    timeout: {
        title: i18nKey('deeplink.error.title_timeout'),
        body: i18nKey('deeplink.error.body_timeout'),
    },
}

/**
 * react-native-notifier renders into a `NotifierRoot` in the React tree, so a
 * toast fired while the QR scanner's RN `Modal` is still open is hidden behind
 * the Modal's native window. Deferring a tick lets the Modal start closing first.
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
