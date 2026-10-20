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
import {
    i18nKey,
    type ChainActionData,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { DEEPLINK_TIMEOUT_TAG } from './timeout'

type Variant =
    | 'generic'
    | 'walletconnect'
    | 'walletconnect_timeout'
    | 'walletconnect_unsupported'
    | 'network-mismatch'
    | 'no-account'
    | 'unsupported-on-chain'
    | 'recover'
    | 'recover_duplicate'
    | 'timeout'

type ChainActionVariant =
    | 'chain-action'
    | 'chain-action-unknown-account'
    | 'chain-action-cannot-sign'

export type ShowDeeplinkErrorParams = {
    parsedType?: string
    error?: unknown
    /** Display names the copy interpolates: `network` or `chain`. */
    values?: Record<string, string>
} & (
    | { variant: Variant }
    | { variant: ChainActionVariant; action: ChainActionData['action'] }
)

type MessageKeys = { title: I18nKey; body: I18nKey }

export type ShowDeeplinkError = (params: ShowDeeplinkErrorParams) => void

const MESSAGE_KEYS: Record<Variant, MessageKeys> = {
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
    'network-mismatch': {
        title: i18nKey('deeplink.error.title_network_mismatch'),
        body: i18nKey('deeplink.error.body_network_mismatch'),
    },
    'no-account': {
        title: i18nKey('deeplink.error.title_no_account'),
        body: i18nKey('deeplink.error.body_no_account'),
    },
    'unsupported-on-chain': {
        title: i18nKey('deeplink.error.title_unsupported'),
        body: i18nKey('deeplink.error.body_unsupported_on_chain'),
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

// Keyed by action so a new chain action can't ship without its own copy.
const CHAIN_ACTION_MESSAGE_KEYS: Record<
    ChainActionData['action'],
    Record<ChainActionVariant, MessageKeys>
> = {
    keyreg: {
        'chain-action': {
            title: i18nKey('deeplink.error.title_keyreg'),
            body: i18nKey('deeplink.error.body_keyreg'),
        },
        'chain-action-unknown-account': {
            title: i18nKey('deeplink.error.title_keyreg'),
            body: i18nKey('deeplink.error.body_keyreg_unknown_account'),
        },
        'chain-action-cannot-sign': {
            title: i18nKey('deeplink.error.title_keyreg'),
            body: i18nKey('deeplink.error.body_keyreg_cannot_sign'),
        },
    },
}

const messageKeysFor = (params: ShowDeeplinkErrorParams): MessageKeys =>
    'action' in params
        ? CHAIN_ACTION_MESSAGE_KEYS[params.action][params.variant]
        : MESSAGE_KEYS[params.variant]

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
        params => {
            const { error, values } = params
            const isTimeout =
                error instanceof Error &&
                'tag' in error &&
                (error as { tag?: string }).tag === DEEPLINK_TIMEOUT_TAG
            const { title, body } = isTimeout
                ? MESSAGE_KEYS.timeout
                : messageKeysFor(params)

            setTimeout(() => {
                errorToast(t(title, values), t(body, values))
            }, TOAST_DEFER_MS)
        },
        [errorToast, t],
    )
}
