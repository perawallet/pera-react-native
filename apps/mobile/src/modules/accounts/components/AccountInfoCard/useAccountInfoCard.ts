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
    chainAccountOf,
    getAccountDisplayName,
    hardwareDetailsOf,
    hdIndexOf,
    isLedgerAccount,
    useCapabilityChainResolver,
    useHdSeedGroups,
    useLedgerDeviceGroups,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useSelectedScope,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { useIsMultichain } from '../../hooks/useIsMultichain'
import { useLanguage } from '@hooks/useLanguage'
import { navigationRef } from '@routes/navigationRef'
import {
    useAccountTypeLabel,
    type AccountTypeLabel,
} from '@hooks/useAccountTypeLabel'
import { displayChainOption } from '@utils/chainOptionDisplay'
import type { IconName } from '@components/core'

export type AccountStructureChainAddress = {
    chainId: ChainId
    displayName: string
    /** Truncated by the chain's codec. */
    address: string
    /** Normalized by the chain's codec (EIP-55 on EVM), for the clipboard. */
    copyValue: string
}

export type AccountStructureRow = {
    account: WalletAccount
    name: string
    isViewing: boolean
    chains: AccountStructureChainAddress[]
}

// Unnamed accounts are stored under one of their addresses, full or cut (legacy
// names use "..."), on any chain they hold, shown or not.
const isNamedAfterOwnAddress = (account: WalletAccount): boolean =>
    (Object.keys(account.chains) as ChainId[]).some(chainId => {
        const address = chainAccountOf(account, chainId)?.address
        if (!address) return false
        return (
            getAccountDisplayName(account, chainId) !== account.name ||
            (addressCodecs.has(chainId) &&
                addressCodecs.get(chainId).truncate(address) === account.name)
        )
    })

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
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedRowId, setExpandedRowId] = useState<Optional<string>>()

    const scope = useSelectedScope(LEGACY_CHAIN_ID)
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
                    copyValue: addressCodecs
                        .get(option.chainId)
                        .normalize(option.address ?? ''),
                }
            })
            const hasRealName = !!member.name && !isNamedAfterOwnAddress(member)
            const fallbackName =
                member.id === structureGroup.firstAccount.id
                    ? t('account_info.main_address')
                    : t('account_info.sub_address')
            return {
                account: member,
                name: hasRealName ? (member.name ?? '') : fallbackName,
                isViewing: member.id === account.id,
                chains,
            }
        })
    }, [structureGroup, switchedOff, account.id, t])

    const showStructure = isHDWallet || (isLedger && structureRows.length > 0)

    const handleToggleRow = useCallback(
        (accountId: string) => {
            if (accountId === account.id) return
            setExpandedRowId(current =>
                current === accountId ? undefined : accountId,
            )
        },
        [account.id],
    )

    // Discovery walks one chain, so the label names the chain it walks. A
    // Ledger account on no Ledger chain falls back the way the Ledger flow does.
    const scanChainId: ChainId = hardwareDetails
        ? (ledgerChainOf(account) ?? firstLedgerChainId)
        : scope.chainId
    const scanLabel = isMultichain
        ? t('account_info.scan_new_accounts', {
              network: chainDisplayNameOf(scanChainId) ?? scanChainId,
          })
        : t('account_info.scan_new_addresses')

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
                    // The rescan runs on a chain the account is on, not the default one.
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
