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
    accountChainOptions,
    unreachableChainsNoteOf,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainFamily,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapabilityCheck,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { useEnableChainAction } from '@hooks/useEnableChainAction'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { displayChainOption } from '@utils/chainOptionDisplay'
import {
    trackEvent,
    AccountOptionsEvent,
    AnalyticsMetadataKey,
} from '@analytics'

export type AccountNetworkRow = {
    chainId: ChainId
    family: ChainFamily
    displayName: string
    /**
     * Truncated by the chain's codec. For a chain not enabled yet it is the
     * address the account holds in the same family; unset when it holds none.
     */
    address?: string
    isEnabled: boolean
    canShowQr: boolean
}

export type UseAccountNetworksParams = {
    account: WalletAccount
    onClose: () => void
    /** Gets the store's current account, which a chain added from the sheet is already on. */
    onShowAddress: (account: WalletAccount, chainId: ChainId) => void
}

export type UseAccountNetworksResult = {
    /** The store's current copy, so a chain enabled from the sheet shows at once. */
    account: WalletAccount
    visibleRows: AccountNetworkRow[]
    hiddenRows: AccountNetworkRow[]
    /** Why the account's kind is missing from chains that are on; null when it reaches them all. */
    unreachableChainsNote: Nullable<string>
    handleShowAllNetworks: () => void
    expandedChainId: Optional<ChainId>
    handleToggleExpanded: (chainId: ChainId) => void
    addingChainId: Optional<ChainId>
    handleAddNetwork: (chainId: ChainId) => void
    handleCopyAddress: (chainId: ChainId) => void
    handleShowQr: (chainId: ChainId) => void
}

export const useAccountNetworks = ({
    account: snapshot,
    onClose,
    onShowAddress,
}: UseAccountNetworksParams): UseAccountNetworksResult => {
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()
    const { showToast } = useToast()
    const { enablingChainId: addingChainId, enableChain } =
        useEnableChainAction(t('account_options.add_network_error'))
    const checkCapability = useChainCapabilityCheck()
    const switchedOff = useSwitchedOffChainIds()
    const accounts = useAllAccounts()
    const account = accounts.find(a => a.id === snapshot.id) ?? snapshot

    const [isShowingAll, setIsShowingAll] = useState(false)

    // Every family the custody reaches, unlike receive's picker: this sheet is where the user adds a new family on purpose.
    const options = useMemo(
        () =>
            accountChainOptions(
                account,
                chainId => !switchedOff.includes(chainId),
                'all',
            ),
        [account, switchedOff],
    )
    const addressByChain = useMemo(
        () => new Map(options.map(option => [option.chainId, option.address])),
        [options],
    )

    const rows = useMemo((): AccountNetworkRow[] => {
        const { chains } = getProvider()
        return options.map(option => {
            const { chainId, isEnabled, displayName, address } =
                displayChainOption(option)
            return {
                chainId,
                family: chains.get(chainId).descriptor.family,
                displayName,
                address,
                isEnabled,
                canShowQr:
                    isEnabled &&
                    checkCapability({
                        chain: { chainId, capability: 'receive' },
                    }),
            }
        })
    }, [options, checkCapability])

    const unreachableChainsNoteKey = useMemo(
        () =>
            unreachableChainsNoteOf(
                account,
                getProvider()
                    .chains.list()
                    .map(({ id }) => id)
                    .filter(chainId => !switchedOff.includes(chainId)),
            ),
        [account, switchedOff],
    )
    const unreachableChainsNote = unreachableChainsNoteKey
        ? t(unreachableChainsNoteKey)
        : null

    const rowByChain = useMemo(
        () => new Map(rows.map(row => [row.chainId, row])),
        [rows],
    )

    // Opened on the one network an account reaches, whose actions are then
    // the only thing the list is for.
    const [expandedChainId, setExpandedChainId] = useState<Optional<ChainId>>(
        () => (rows.length === 1 ? rows[0]?.chainId : undefined),
    )

    const enabledRows = rows.filter(row => row.isEnabled)
    const addableRows = rows.filter(row => !row.isEnabled)
    const visibleRows = isShowingAll
        ? [...enabledRows, ...addableRows]
        : enabledRows
    const hiddenRows = isShowingAll ? [] : addableRows

    const handleShowAllNetworks = useCallback(() => setIsShowingAll(true), [])

    const handleToggleExpanded = useCallback((chainId: ChainId) => {
        setExpandedChainId(current =>
            current === chainId ? undefined : chainId,
        )
    }, [])

    const handleAddNetwork = useCallback(
        (chainId: ChainId) => {
            const row = rowByChain.get(chainId)
            if (row?.isEnabled !== false) return
            enableChain(account.id, chainId, () =>
                showToast(
                    {
                        title: t('account_options.add_network_success', {
                            network: row.displayName,
                        }),
                        body: '',
                        type: 'success',
                    },
                    { notifier: bottomSheetNotifier.current ?? undefined },
                ),
            )
        },
        [rowByChain, account.id, enableChain, showToast, t],
    )

    const handleCopyAddress = useCallback(
        (chainId: ChainId) => {
            const address = addressByChain.get(chainId)
            if (address === undefined) return
            trackEvent(AccountOptionsEvent.CopyAddress, {
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
            void copyToClipboard(addressCodecs.get(chainId).normalize(address))
            onClose()
        },
        [addressByChain, copyToClipboard, onClose],
    )

    const handleShowQr = useCallback(
        (chainId: ChainId) => {
            onClose()
            onShowAddress(account, chainId)
        },
        [account, onClose, onShowAddress],
    )

    return {
        account,
        visibleRows,
        hiddenRows,
        unreachableChainsNote,
        handleShowAllNetworks,
        expandedChainId,
        handleToggleExpanded,
        addingChainId,
        handleAddNetwork,
        handleCopyAddress,
        handleShowQr,
    }
}
