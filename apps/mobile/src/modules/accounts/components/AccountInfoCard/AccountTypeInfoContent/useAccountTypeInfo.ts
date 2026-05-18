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

import { useCallback, useMemo } from 'react'
import {
    AccountTypes,
    useCanSignWith,
    useRekeyTransition,
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import {
    getRekeyLabelI18n,
    splitAccountTypeLabel,
} from '@modules/accounts/utils/rekeyLabels'

type UseAccountTypeInfoParams = {
    account: WalletAccount
}

type UseAccountTypeInfoResult = {
    title: string
    /**
     * Rekey transition qualifier (e.g. "(Standard to Ledger)"), shown on its
     * own line below the title. Null for non-rekeyed account types.
     */
    titleQualifier: string | null
    description: string
    handleLearnMore: () => void
}

const TYPE_I18N: Record<AccountType, { title: string; description: string }> = {
    [AccountTypes.algo25]: {
        title: 'account_type_info.standard_title',
        description: 'account_type_info.standard_description',
    },
    [AccountTypes.hdWallet]: {
        title: 'account_type_info.hd_wallet_title',
        description: 'account_type_info.hd_wallet_description',
    },
    [AccountTypes.hardware]: {
        title: 'account_type_info.ledger_title',
        description: 'account_type_info.ledger_description',
    },
    [AccountTypes.multisig]: {
        title: 'account_type_info.multisig_title',
        description: 'account_type_info.multisig_description',
    },
    [AccountTypes.watch]: {
        title: 'account_type_info.watch_title',
        description: 'account_type_info.watch_description',
    },
}

const REKEYED_UNSIGNABLE_I18N = {
    title: 'account_type_info.no_auth_title',
    description: 'account_type_info.no_auth_description',
}

const REKEYED_SIGNABLE_I18N = {
    title: 'account_type_info.rekeyed_standard_title',
    description: 'account_type_info.rekeyed_standard_description',
}

export const useAccountTypeInfo = ({
    account,
}: UseAccountTypeInfoParams): UseAccountTypeInfoResult => {
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const canSign = useCanSignWith(account)
    const rekeyTransition = useRekeyTransition(account.address)

    const { title, titleQualifier, description } = useMemo(() => {
        if (rekeyTransition) {
            const { labelKey, fromKey, toKey, descriptionKey } =
                getRekeyLabelI18n(rekeyTransition)
            const label = t(labelKey, { from: t(fromKey), to: t(toKey) })
            const { main, qualifier } = splitAccountTypeLabel(label)
            return {
                title: main,
                titleQualifier: qualifier,
                description: t(descriptionKey),
            }
        }

        if (account.rekeyAddress) {
            const i18n = canSign
                ? REKEYED_SIGNABLE_I18N
                : REKEYED_UNSIGNABLE_I18N
            return {
                title: t(i18n.title),
                titleQualifier: null,
                description: t(i18n.description),
            }
        }

        const i18n = TYPE_I18N[account.type]
        return {
            title: t(i18n.title),
            titleQualifier: null,
            description: t(i18n.description),
        }
    }, [account, canSign, rekeyTransition, t])

    const handleLearnMore = useCallback(() => {
        const url =
            account.type === AccountTypes.hardware
                ? config.ledgerAccountSupportUrl
                : config.accountTypeSupportUrl
        pushWebView({ url })
    }, [pushWebView, account.type])

    return {
        title,
        titleQualifier,
        description,
        handleLearnMore,
    }
}
