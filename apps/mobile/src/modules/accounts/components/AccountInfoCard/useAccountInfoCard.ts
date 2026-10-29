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
    accountChainOptions,
    hardwareDetailsOf,
    hdIndexOf,
    isLedgerAccount,
    useCapabilityChainResolver,
    useHdSeedGroups,
    useLedgerDeviceGroups,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { useIsMultichain } from '../../hooks/useIsMultichain'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountName } from '@hooks/useAccountName'
import { navigationRef } from '@routes/navigationRef'
import {
    useAccountTypeLabel,
    type AccountTypeLabel,
} from '@hooks/useAccountTypeLabel'
import {
    chainAddressCopyValue,
    displayChainOption,
} from '@utils/chainOptionDisplay'
import type { IconName } from '@components/core'
import type { ChainAddress } from '@components/ChainAddressList'

export type AccountStructureRow = {
    account: WalletAccount
    name: string
    isViewing: boolean
    /** Not the sheet's own account, and on at least one shown chain. */
    canExpand: boolean
    chains: ChainAddress[]
}

type UseAccountInfoCardParams = {
    account: WalletAccount
    onClose: () => void
}

type UseAccountInfoCardResult = {
    isExpanded: boolean
    handleToggleExpanded: () => void
    accountType: AccountTypeLabel
    showStructure: boolean
    /** More than one chain is active; otherwise the tree keeps its single-chain layout. */
    isMultichain: boolean
    structureLabel: string
    structureSubtitle: Optional<string>
    structureIcon: IconName
    structureRows: AccountStructureRow[]
    expandedRowId: Optional<string>
    handleToggleRow: (accountId: string) => void
    scanLabel: string
    handleScanAddresses: () => void
}

export const useAccountInfoCard = ({
    account,
    onClose,
}: UseAccountInfoCardParams): UseAccountInfoCardResult => {
    const { t } = useLanguage()
    const { getAccountName } = useAccountName()
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedRowId, setExpandedRowId] = useState<Optional<string>>()

    const switchedOff = useSwitchedOffChainIds()
    const isMultichain = useIsMultichain()

    const { hdSeedGroups } = useHdSeedGroups()
    const { ledgerDeviceGroups } = useLedgerDeviceGroups()
    const ledgerChainOf = useCapabilityChainResolver('ledger')
    const firstLedgerChainId = useCapableChainId('ledger')

    const isHDWallet = hdIndexOf(account) !== undefined
    const isLedger = isLedgerAccount(account)
    const hardwareDetails = useMemo(
        () => (isLedger ? hardwareDetailsOf(account) : undefined),
        [isLedger, account],
    )
    const accountType = useAccountTypeLabel(account)

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev)
    }, [])

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

    const structureSubtitle =
        isHDWallet && isMultichain
            ? t('account_info.universal_wallet_subtitle')
            : undefined

    const structureIcon: IconName = isLedger ? 'ledger' : 'wallet'

    const structureGroup = useMemo<{
        accounts: WalletAccount[]
        firstAccount: WalletAccount
    } | null>(() => {
        if (isHDWallet && hdSeedGroupIndex >= 0) {
            return hdSeedGroups[hdSeedGroupIndex]
        }
        if (isLedger && ledgerDeviceGroup) {
            return ledgerDeviceGroup
        }
        return null
    }, [
        isHDWallet,
        hdSeedGroupIndex,
        hdSeedGroups,
        isLedger,
        ledgerDeviceGroup,
    ])

    const structureRows = useMemo<AccountStructureRow[]>(() => {
        if (!structureGroup) return []
        return structureGroup.accounts.map(member => {
            const options = accountChainOptions(
                member,
                chainId => !switchedOff.includes(chainId),
            ).filter(option => option.isEnabled && option.address)
            const chains = options.map(option => {
                const displayed = displayChainOption(option)
                return {
                    chainId: option.chainId,
                    displayName: displayed.displayName,
                    address: displayed.address ?? '',
                    copyValue: chainAddressCopyValue(
                        option.chainId,
                        option.address ?? '',
                    ),
                }
            })
            const isViewing = member.id === account.id
            return {
                account: member,
                name: getAccountName(
                    member,
                    options[0]?.chainId ?? LEGACY_CHAIN_ID,
                ),
                isViewing,
                canExpand: !isViewing && chains.length > 0,
                chains,
            }
        })
    }, [structureGroup, switchedOff, account.id, getAccountName])

    const showStructure = isHDWallet || (isLedger && structureRows.length > 0)

    const handleToggleRow = useCallback(
        (accountId: string) => {
            const row = structureRows.find(
                candidate => candidate.account.id === accountId,
            )
            if (!row?.canExpand) return
            setExpandedRowId(current =>
                current === accountId ? undefined : accountId,
            )
        },
        [structureRows],
    )

    // Only a Ledger scan walks a single chain, so its label names that chain. A
    // Ledger account on no Ledger chain falls back the way the Ledger flow does.
    const scanChainId: ChainId = hardwareDetails
        ? (ledgerChainOf(account) ?? firstLedgerChainId)
        : LEGACY_CHAIN_ID
    let scanLabel = t('account_info.scan_new_addresses')
    if (isHDWallet) {
        scanLabel = t('account_info.scan_new_wallet_accounts')
    } else if (isMultichain) {
        scanLabel = t('account_info.scan_new_accounts', {
            network: chainDisplayNameOf(scanChainId) ?? scanChainId,
        })
    }

    const handleScanAddresses = useCallback(() => {
        if (isHDWallet) {
            onClose()
            navigationRef.navigate('AddAccount', {
                screen: 'SearchAccounts',
                params: { account },
            })
            return
        }
        if (hardwareDetails) {
            onClose()
            navigationRef.navigate('AddAccount', {
                screen: 'LedgerFetchAccounts',
                params: {
                    chainId: scanChainId,
                    deviceId: hardwareDetails.deviceId,
                    deviceName: hardwareDetails.deviceName,
                    transportType: hardwareDetails.transportType,
                },
            })
        }
    }, [account, isHDWallet, hardwareDetails, scanChainId, onClose])

    return {
        isExpanded,
        handleToggleExpanded,
        accountType,
        showStructure,
        isMultichain,
        structureLabel,
        structureSubtitle,
        structureIcon,
        structureRows,
        expandedRowId,
        handleToggleRow,
        scanLabel,
        handleScanAddresses,
    }
}
