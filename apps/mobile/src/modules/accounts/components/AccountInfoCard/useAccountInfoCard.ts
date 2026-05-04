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
    AccountTypes,
    WalletAccount,
    isHDWalletAccount,
    isLedgerAccount,
    isSigningLogicalType,
    useAccountLogicalType,
    useHDWalletGroups,
    useLedgerDeviceGroups,
    useAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { navigationRef } from '@routes/navigationRef'
import { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'

export type SharedAccountDetails = {
    participantCount: number
    threshold: number
    addresses: string[]
}

type UseAccountInfoCardParams = {
    account: WalletAccount
    onClose: () => void
}

type UseAccountInfoCardResult = {
    isExpanded: boolean
    handleToggleExpanded: () => void
    accountTypeLabel: string
    minBalanceAlgos: Nullable<Decimal>
    isMinBalanceLoading: boolean
    showMinBalance: boolean
    showStructure: boolean
    showSharedAccountDetails: boolean
    sharedAccountDetails: Nullable<SharedAccountDetails>
    structureLabel: string
    structureIcon: IconName
    structureAccounts: WalletAccount[]
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
    const isMultisig = account.type === AccountTypes.multisig
    const logicalType =
        useAccountLogicalType(account.address) ??
        (isMultisig ? 'Multisig' : 'NoAuth')
    const showMinBalance = isSigningLogicalType(logicalType)
    const showStructure = isHDWallet || isLedger
    const sharedAccountDetails = useMemo<Nullable<SharedAccountDetails>>(() => {
        if (!isMultisig) return null

        return {
            participantCount: account.multisigDetails.addresses.length,
            threshold: account.multisigDetails.threshold,
            addresses: account.multisigDetails.addresses,
        }
    }, [account, isMultisig])

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev)
    }, [])

    const accountTypeLabel = useMemo(() => {
        switch (logicalType) {
            case 'HdKey':
                return t('account_info.type_universal_wallet')
            case 'Algo25':
                return t('account_info.type_algo25')
            case 'LedgerBle':
                return t('account_info.type_ledger')
            case 'Multisig':
                return t('account_info.type_multisig', {
                    count: isMultisig
                        ? account.multisigDetails.addresses.length
                        : 0,
                })
            case 'NoAuth':
                return t('account_info.type_watch')
            case 'Rekeyed':
            case 'RekeyedAuth':
                return t('account_info.type_rekeyed')
            default:
                return t('account_info.type_unknown')
        }
    }, [account, isMultisig, logicalType, t])

    const minBalanceAlgos = useMemo(() => {
        if (accountInfo?.minBalance == null) return null
        return microAlgosToAlgos(accountInfo.minBalance)
    }, [accountInfo?.minBalance])

    const hdWalletGroupIndex = useMemo(() => {
        if (!isHDWallet) return -1
        return hdWalletGroups.findIndex(
            group => group.keyPairId === account.keyPairId,
        )
    }, [isHDWallet, hdWalletGroups, account.keyPairId])

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

    const handleScanAddresses = useCallback(() => {
        if (isHDWalletAccount(account)) {
            onClose()
            navigationRef.navigate('AddAccount', {
                screen: 'SearchAccounts',
                params: {
                    account,
                    createIfEmpty: true,
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
                },
            })
        }
    }, [account, onClose])

    return {
        isExpanded,
        handleToggleExpanded,
        accountTypeLabel,
        minBalanceAlgos,
        isMinBalanceLoading,
        showMinBalance,
        showStructure,
        showSharedAccountDetails: isMultisig,
        sharedAccountDetails,
        structureLabel,
        structureIcon,
        structureAccounts,
        handleScanAddresses,
    }
}
