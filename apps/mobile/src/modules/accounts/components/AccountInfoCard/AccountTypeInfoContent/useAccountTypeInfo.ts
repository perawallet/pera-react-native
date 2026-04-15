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
    WalletAccount,
    isRekeyedAccount,
    canSignWithAccount,
    hasSigningKeys,
    useAllAccounts,
    useAccountAuthAddresses,
    resolveAccountStatus,
    type AccountStatus,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { IconName } from '@components/core'

export type AccountTypeAction = {
    id: string
    title: string
    icon: IconName
    onPress: () => void
}

type UseAccountTypeInfoParams = {
    account: WalletAccount
    onClose: () => void
}

type UseAccountTypeInfoResult = {
    title: string
    description: string
    actions: AccountTypeAction[]
    handleLearnMore: () => void
}

const STATUS_I18N_MAP: Record<
    AccountStatus,
    { title: string; description: string }
> = {
    standard: {
        title: 'account_type_info.standard_title',
        description: 'account_type_info.standard_description',
    },
    hardware: {
        title: 'account_type_info.ledger_title',
        description: 'account_type_info.ledger_description',
    },
    watch: {
        title: 'account_type_info.watch_title',
        description: 'account_type_info.watch_description',
    },
    noAuth: {
        title: 'account_type_info.no_auth_title',
        description: 'account_type_info.no_auth_description',
    },
    rekeyedStandard: {
        title: 'account_type_info.rekeyed_standard_title',
        description: 'account_type_info.rekeyed_standard_description',
    },
    rekeyedHardware: {
        title: 'account_type_info.rekeyed_ledger_title',
        description: 'account_type_info.rekeyed_ledger_description',
    },
    hdWallet: {
        title: 'account_type_info.hd_wallet_title',
        description: 'account_type_info.hd_wallet_description',
    },
    multisig: {
        title: 'account_type_info.multisig_title',
        description: 'account_type_info.multisig_description',
    },
}

export const useAccountTypeInfo = ({
    account,
    onClose,
}: UseAccountTypeInfoParams): UseAccountTypeInfoResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { pushWebView } = useWebView()
    const accounts = useAllAccounts()
    const { authAddresses } = useAccountAuthAddresses()
    const accountAuthAddress = authAddresses.get(account.address) ?? null

    const status = useMemo(
        () => resolveAccountStatus(account, accounts, accountAuthAddress),
        [account, accounts, accountAuthAddress],
    )

    const title = t(STATUS_I18N_MAP[status].title)
    const description = t(STATUS_I18N_MAP[status].description)

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
        onClose()
    }, [showToast, t, onClose])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.accountTypeSupportUrl })
    }, [pushWebView])

    const actions = useMemo(() => {
        const items: AccountTypeAction[] = []

        if (canSignWithAccount(account, accounts, authAddresses)) {
            items.push({
                id: 'rekey-to-ledger',
                title: t('account_type_info.rekey_to_ledger'),
                icon: 'rekey',
                onPress: notImplemented,
            })
            items.push({
                id: 'rekey-to-standard',
                title: t('account_type_info.rekey_to_standard'),
                icon: 'rekey',
                onPress: notImplemented,
            })
        }

        if (
            isRekeyedAccount(account, accountAuthAddress) &&
            hasSigningKeys(account)
        ) {
            items.push({
                id: 'undo-rekey',
                title: t('account_type_info.undo_rekey'),
                icon: 'undo',
                onPress: notImplemented,
            })
        }

        if (isRekeyedAccount(account, accountAuthAddress)) {
            items.push({
                id: 'rescan-rekeyed',
                title: t('account_type_info.rescan_rekeyed'),
                icon: 'reload',
                onPress: notImplemented,
            })
        }

        return items
    }, [
        account,
        accounts,
        accountAuthAddress,
        authAddresses,
        t,
        notImplemented,
    ])

    return {
        title,
        description,
        actions,
        handleLearnMore,
    }
}
