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
    addressOn,
    hardwareDetailsOf,
    hdIndexOf,
    isLedgerAccount,
    useAccountStateQuery,
    useCanSignWith,
    useHdSeedGroups,
    useLedgerDeviceGroups,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { navigationRef } from '@routes/navigationRef'
import type { Decimal } from 'decimal.js'
import {
    useAccountTypeLabel,
    type AccountTypeLabel,
} from '@hooks/useAccountTypeLabel'
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

    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { data: accountState, isLoading: isMinBalanceLoading } =
        useAccountStateQuery(account, scope)

    const { hdSeedGroups } = useHdSeedGroups()
    const { ledgerDeviceGroups } = useLedgerDeviceGroups()

    const isHDWallet = hdIndexOf(account) !== undefined
    const isLedger = isLedgerAccount(account)
    const hardwareDetails = useMemo(
        () => (isLedger ? hardwareDetailsOf(account) : undefined),
        [isLedger, account],
    )
    const showMinBalance = useCanSignWith(account, scope.chainId)
    const accountType = useAccountTypeLabel(account)

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev)
    }, [])

    const { decimals: nativeDecimals } = useNativeAsset()
    const minBalanceBaseUnits = accountState?.reserveBalance
    const minBalanceAlgos = useMemo(
        () =>
            minBalanceBaseUnits === undefined
                ? null
                : baseUnitsToDisplayUnits(minBalanceBaseUnits, nativeDecimals),
        [minBalanceBaseUnits, nativeDecimals],
    )

    const hdSeedGroupIndex = useMemo(() => {
        if (!isHDWallet) return -1
        // Account.keyPairId is the derived child id; match by membership
        // rather than by id since the group's `seedKeyId` is the parent.
        return hdSeedGroups.findIndex(group =>
            group.accounts.some(a => a.id === account.id),
        )
    }, [isHDWallet, hdSeedGroups, account.id])

    const ledgerDeviceGroup = useMemo(() => {
        if (!hardwareDetails) return null
        return (
            ledgerDeviceGroups.find(
                g => g.deviceId === hardwareDetails.deviceId,
            ) ?? null
        )
    }, [hardwareDetails, ledgerDeviceGroups])

    const structureLabel = useMemo(() => {
        if (isHDWallet) {
            return t('account_info.wallet_label', {
                number: hdSeedGroupIndex + 1,
            })
        }
        if (hardwareDetails) {
            return hardwareDetails.deviceName
        }
        return ''
    }, [isHDWallet, hardwareDetails, hdSeedGroupIndex, t])

    const structureIcon: IconName = isLedger ? 'ledger' : 'wallet'

    const structureAccounts = useMemo<WalletAccount[]>(() => {
        if (isHDWallet && hdSeedGroupIndex >= 0) {
            return hdSeedGroups[hdSeedGroupIndex].accounts
        }
        if (isLedger && ledgerDeviceGroup) {
            return ledgerDeviceGroup.accounts
        }
        return []
    }, [
        isHDWallet,
        hdSeedGroupIndex,
        hdSeedGroups,
        isLedger,
        ledgerDeviceGroup,
    ])

    const structureMainAddress = useMemo<string>(() => {
        if (isHDWallet && hdSeedGroupIndex >= 0) {
            return (
                addressOn(hdSeedGroups[hdSeedGroupIndex].firstAccount, scope) ??
                ''
            )
        }
        if (isLedger && ledgerDeviceGroup) {
            return addressOn(ledgerDeviceGroup.firstAccount, scope) ?? ''
        }
        return ''
    }, [
        isHDWallet,
        hdSeedGroupIndex,
        hdSeedGroups,
        isLedger,
        ledgerDeviceGroup,
        scope,
    ])

    const showStructure =
        isHDWallet || (isLedger && structureAccounts.length > 0)

    const handleScanAddresses = useCallback(() => {
        if (isHDWallet) {
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
        if (hardwareDetails) {
            onClose()
            navigationRef.navigate('AddAccount', {
                screen: 'LedgerFetchAccounts',
                params: {
                    deviceId: hardwareDetails.deviceId,
                    deviceName: hardwareDetails.deviceName,
                    transportType: hardwareDetails.transportType,
                },
            })
        }
    }, [account, isHDWallet, hardwareDetails, onClose])

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
