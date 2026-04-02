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

import { useCallback, useMemo, useState } from 'react'
import {
    WalletAccount,
    HDWalletAccount,
    isHDWalletAccount,
    isSigningAccount,
    useAllAccounts,
    useHDWalletGroups,
    useAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { navigationRef } from '@routes/navigationRef'
import { Decimal } from 'decimal.js'

type UseAccountInfoCardParams = {
    account: WalletAccount
    onClose: () => void
}

type UseAccountInfoCardResult = {
    isExpanded: boolean
    handleToggleExpanded: () => void
    accountTypeLabel: string
    minBalanceAlgos: Decimal | null
    isMinBalanceLoading: boolean
    isHDWallet: boolean
    showMinBalance: boolean
    walletLabel: string
    walletAccounts: HDWalletAccount[]
    handleScanAddresses: () => void
}

export const useAccountInfoCard = ({
    account,
    onClose,
}: UseAccountInfoCardParams): UseAccountInfoCardResult => {
    const { t } = useLanguage()
    const [isExpanded, setIsExpanded] = useState(false)

    const { data: accountInfo, isLoading: isMinBalanceLoading } =
        useAccountInformationQuery(account.address)

    const { hdWalletGroups } = useHDWalletGroups()

    const allAccounts = useAllAccounts()
    const isHDWallet = isHDWalletAccount(account)
    const showMinBalance = isSigningAccount(account, allAccounts)

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev)
    }, [])

    const accountTypeLabel = useMemo(() => {
        switch (account.type) {
            case 'hdWallet':
                return t('account_info.type_universal_wallet')
            case 'algo25':
                return t('account_info.type_algo25')
            case 'watch':
                return t('account_info.type_watch')
            case 'hardware':
                return t('account_info.type_ledger')
            case 'multisig':
                return t('account_info.type_multisig')
            default:
                return t('account_info.type_unknown')
        }
    }, [account.type, t])

    const minBalanceAlgos = useMemo(() => {
        if (accountInfo?.minBalance == null) return null
        return microAlgosToAlgos(accountInfo.minBalance)
    }, [accountInfo?.minBalance])

    const walletGroupIndex = useMemo(() => {
        if (!isHDWallet) return 0
        return hdWalletGroups.findIndex(
            group => group.keyPairId === account.keyPairId,
        )
    }, [isHDWallet, hdWalletGroups, account.keyPairId])

    const walletLabel = useMemo(() => {
        return t('account_info.wallet_label', {
            number: walletGroupIndex + 1,
        })
    }, [walletGroupIndex, t])

    const walletAccounts = useMemo(() => {
        if (!isHDWallet || walletGroupIndex < 0) return []
        return hdWalletGroups[walletGroupIndex].accounts
    }, [isHDWallet, walletGroupIndex, hdWalletGroups])

    const handleScanAddresses = useCallback(() => {
        if (!isHDWalletAccount(account)) return

        onClose()
        navigationRef.navigate('AddAccount', {
            screen: 'SearchAccounts',
            params: {
                account,
                createIfEmpty: true,
            },
        })
    }, [account, onClose])

    return {
        isExpanded,
        handleToggleExpanded,
        accountTypeLabel,
        minBalanceAlgos,
        isMinBalanceLoading,
        isHDWallet,
        showMinBalance,
        walletLabel,
        walletAccounts,
        handleScanAddresses,
    }
}
