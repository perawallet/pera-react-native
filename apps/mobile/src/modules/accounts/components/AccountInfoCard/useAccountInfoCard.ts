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

import { useCallback, useMemo, useState } from 'react'
import {
    type WalletAccount,
    isHDWalletAccount,
    isLedgerAccount,
    useCanSignWith,
    useHDWalletGroups,
    useLedgerDeviceGroups,
    useAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { navigationRef } from '@routes/navigationRef'
import type { Decimal } from 'decimal.js'
import {
    useAccountTypeLabel,
    type AccountTypeLabel,
} from '@modules/accounts/hooks/useAccountTypeLabel'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'

type UseAccountInfoCardParams = {
    account: WalletAccount
    onClose: () => void
}

type UseAccountInfoCardResult = {
    isExpanded: boolean
    handleToggleExpanded: () => void
    accountType: AccountTypeLabel
    minBalanceAlgos: Nullable<Decimal>
    isMinBalanceLoading: boolean
    showMinBalance: boolean
    showStructure: boolean
    structureLabel: string
    structureIcon: IconName
    structureAccounts: WalletAccount[]
    structureMainAddress: string
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
    const { ledgerDeviceGroups } = useLedgerDeviceGroups()

    const isHDWallet = isHDWalletAccount(account)
    const isLedger = isLedgerAccount(account)
    const showMinBalance = useCanSignWith(account)
    const accountType = useAccountTypeLabel(account)

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev)
    }, [])

    const minBalanceAlgos = useMemo(() => {
        if (accountInfo?.minBalance == null) return null
        return microAlgosToAlgos(accountInfo.minBalance)
    }, [accountInfo?.minBalance])

    const hdWalletGroupIndex = useMemo(() => {
        if (!isHDWallet) return -1
        // Account.keyPairId is the derived child id; match by membership
        // rather than by id since the group's `seedKeyId` is the parent.
        return hdWalletGroups.findIndex(group =>
            group.accounts.some(a => a.id === account.id),
        )
    }, [isHDWallet, hdWalletGroups, account.id])

    const ledgerDeviceGroup = useMemo(() => {
        if (!isLedgerAccount(account)) return null
        return (
            ledgerDeviceGroups.find(
                g => g.deviceId === account.hardwareDetails.deviceId,
            ) ?? null
        )
    }, [account, ledgerDeviceGroups])

    const structureLabel = useMemo(() => {
        if (isHDWallet) {
            return t('account_info.wallet_label', {
                number: hdWalletGroupIndex + 1,
            })
        }
        if (isLedgerAccount(account)) {
            return account.hardwareDetails.deviceName
        }
        return ''
    }, [isHDWallet, account, hdWalletGroupIndex, t])

    const structureIcon: IconName = isLedger ? 'ledger' : 'wallet'

    const structureAccounts = useMemo<WalletAccount[]>(() => {
        if (isHDWallet && hdWalletGroupIndex >= 0) {
            return hdWalletGroups[hdWalletGroupIndex].accounts
        }
        if (isLedger && ledgerDeviceGroup) {
            return ledgerDeviceGroup.accounts
        }
        return []
    }, [
        isHDWallet,
        hdWalletGroupIndex,
        hdWalletGroups,
        isLedger,
        ledgerDeviceGroup,
    ])

    const structureMainAddress = useMemo<string>(() => {
        if (isHDWallet && hdWalletGroupIndex >= 0) {
            return hdWalletGroups[hdWalletGroupIndex].firstAccount.address
        }
        if (isLedger && ledgerDeviceGroup) {
            return ledgerDeviceGroup.firstAccount.address
        }
        return ''
    }, [
        isHDWallet,
        hdWalletGroupIndex,
        hdWalletGroups,
        isLedger,
        ledgerDeviceGroup,
    ])

    const showStructure =
        isHDWallet || (isLedger && structureAccounts.length > 0)

    const handleScanAddresses = useCallback(() => {
        if (isHDWalletAccount(account)) {
            onClose()
            navigationRef.navigate('AddAccount', {
                screen: 'SearchAccounts',
                params: {
                    account,
                    notifyOnEmpty: true,
                },
            })
            return
        }
        if (isLedgerAccount(account)) {
            onClose()
            navigationRef.navigate('AddAccount', {
                screen: 'LedgerFetchAccounts',
                params: {
                    deviceId: account.hardwareDetails.deviceId,
                    deviceName: account.hardwareDetails.deviceName,
                    transportType: account.hardwareDetails.transportType,
                },
            })
        }
    }, [account, onClose])

    return {
        isExpanded,
        handleToggleExpanded,
        accountType,
        minBalanceAlgos,
        isMinBalanceLoading,
        showMinBalance,
        showStructure,
        structureLabel,
        structureIcon,
        structureAccounts,
        structureMainAddress,
        handleScanAddresses,
    }
}
