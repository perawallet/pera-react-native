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

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useCallback, useMemo } from 'react'
import {
    accountType,
    type AccountType,
    AccountTypes,
    isMultisigAccount,
    useAuthorityOf,
    useCanSignWith,
    useDelegatedTransition,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { getRekeyLabelI18n, splitAccountTypeLabel } from '@utils/rekeyLabels'

type UseAccountTypeInfoParams = {
    account: WalletAccount
}

type UseAccountTypeInfoResult = {
    title: string
    /**
     * Signer qualifier (e.g. "(Signed by a Ledger account)"), shown on its own
     * line below the title. Null for non-rekeyed account types.
     */
    titleQualifier: string | null
    description: string
    handleLearnMore: () => void
}

const TYPE_I18N: Record<AccountType, { title: string; description: string }> = {
    [AccountTypes.standalone]: {
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
    [AccountTypes.quantum]: {
        title: 'account_type_info.quantum_title',
        description: 'account_type_info.quantum_description',
    },
}

const SUPPORT_URL: Record<AccountType, string> = {
    [AccountTypes.standalone]: config.accountTypeSupportUrl,
    [AccountTypes.hdWallet]: config.accountTypeSupportUrl,
    [AccountTypes.watch]: config.accountTypeSupportUrl,
    [AccountTypes.hardware]: config.ledgerAccountSupportUrl,
    [AccountTypes.multisig]: config.multisigSupportUrl,
    [AccountTypes.quantum]: config.quantumAccountSupportUrl,
}

const REKEYED_UNSIGNABLE_I18N = {
    title: 'account_type_info.no_auth_title',
    description: 'account_type_info.no_auth_description',
}

const REKEYED_SIGNABLE_I18N = {
    title: 'account_type_info.rekeyed_standard_title',
    description: 'account_type_info.rekeyed_standard_description',
}

const MULTISIG_UNSIGNABLE_I18N = {
    title: 'account_type_info.no_auth_title',
    description: 'account_type_info.multisig_no_auth_description',
}

export const useAccountTypeInfo = ({
    account,
}: UseAccountTypeInfoParams): UseAccountTypeInfoResult => {
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const canSign = useCanSignWith(account)
    const delegateTransition = useDelegatedTransition(account.address)
    const authority = useAuthorityOf(account, useSelectedScope(LEGACY_CHAIN_ID))

    const { title, titleQualifier, description } = useMemo(() => {
        if (delegateTransition) {
            const { labelKey, signerKey, descriptionKey } =
                getRekeyLabelI18n(delegateTransition)
            const label = t(labelKey, { to: t(signerKey) })
            const { main, qualifier } = splitAccountTypeLabel(label)
            return {
                title: main,
                titleQualifier: qualifier,
                description: t(descriptionKey),
            }
        }

        if (authority !== null) {
            const i18n = canSign
                ? REKEYED_SIGNABLE_I18N
                : REKEYED_UNSIGNABLE_I18N
            return {
                title: t(i18n.title),
                titleQualifier: null,
                description: t(i18n.description),
            }
        }

        if (isMultisigAccount(account) && !canSign) {
            return {
                title: t(MULTISIG_UNSIGNABLE_I18N.title),
                titleQualifier: null,
                description: t(MULTISIG_UNSIGNABLE_I18N.description),
            }
        }

        const i18n = TYPE_I18N[accountType(account)]
        return {
            title: t(i18n.title),
            titleQualifier: null,
            description: t(i18n.description),
        }
    }, [account, authority, canSign, delegateTransition, t])

    const handleLearnMore = useCallback(() => {
        // A rekeyed account's sheet copy describes its signer, not its own
        // type, so the article has to follow the same type to match.
        const type = delegateTransition?.to ?? accountType(account)
        pushWebView({ url: SUPPORT_URL[type] })
    }, [pushWebView, account, delegateTransition])

    return {
        title,
        titleQualifier,
        description,
        handleLearnMore,
    }
}
