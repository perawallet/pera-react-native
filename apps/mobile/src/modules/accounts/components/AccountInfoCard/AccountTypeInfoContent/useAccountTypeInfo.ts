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

import { useCallback, useMemo } from 'react'
import {
    AccountTypes,
    isRekeyedAccount,
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
     * Signer qualifier (e.g. "(Signed by a Ledger account)"), shown on its own
     * line below the title. Null for non-rekeyed account types.
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
    [AccountTypes.quantum]: {
        title: 'account_type_info.quantum_title',
        description: 'account_type_info.quantum_description',
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
    const rekeyTransition = useRekeyTransition(account.address)

    const { title, titleQualifier, description } = useMemo(() => {
        if (rekeyTransition) {
            const { labelKey, signerKey, descriptionKey } =
                getRekeyLabelI18n(rekeyTransition)
            const label = t(labelKey, { to: t(signerKey) })
            const { main, qualifier } = splitAccountTypeLabel(label)
            return {
                title: main,
                titleQualifier: qualifier,
                description: t(descriptionKey),
            }
        }

        if (isRekeyedAccount(account)) {
            const i18n = canSign
                ? REKEYED_SIGNABLE_I18N
                : REKEYED_UNSIGNABLE_I18N
            return {
                title: t(i18n.title),
                titleQualifier: null,
                description: t(i18n.description),
            }
        }

        if (account.type === AccountTypes.multisig && !canSign) {
            return {
                title: t(MULTISIG_UNSIGNABLE_I18N.title),
                titleQualifier: null,
                description: t(MULTISIG_UNSIGNABLE_I18N.description),
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
        // Send shared accounts — and accounts rekeyed to a shared account — to
        // the shared-accounts article rather than the generic account-types
        // page, matching the info sheet's copy.
        const isShared =
            account.type === AccountTypes.multisig ||
            rekeyTransition?.to === AccountTypes.multisig
        let url = config.accountTypeSupportUrl
        if (account.type === AccountTypes.hardware) {
            url = config.ledgerAccountSupportUrl
        } else if (isShared) {
            url = config.multisigSupportUrl
        }
        pushWebView({ url })
    }, [pushWebView, account.type, rekeyTransition])

    return {
        title,
        titleQualifier,
        description,
        handleLearnMore,
    }
}
