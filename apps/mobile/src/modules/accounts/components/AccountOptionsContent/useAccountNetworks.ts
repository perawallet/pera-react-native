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

import { useCallback, useMemo, useRef, useState } from 'react'
import {
    accountChainOptions,
    useAllAccounts,
    useEnableChain,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainFamily,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useChainCapabilityCheck,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Optional } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { useErrorToast } from '@hooks/useErrorToast'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import {
    trackEvent,
    AccountOptionsEvent,
    AnalyticsMetadataKey,
} from '@analytics'

export const COLLAPSED_NETWORK_COUNT = 3

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
    const { showError } = useErrorToast()
    const enableChain = useEnableChain()
    const isMounted = useIsMounted()
    const checkCapability = useChainCapabilityCheck()
    const switchedOff = useSwitchedOffChainIds()
    const accounts = useAllAccounts()
    const account = accounts.find(a => a.id === snapshot.id) ?? snapshot

    const [isShowingAll, setIsShowingAll] = useState(false)
    const [expandedChainId, setExpandedChainId] = useState<Optional<ChainId>>()
    const [addingChainId, setAddingChainId] = useState<Optional<ChainId>>()
    // State lags a second tap that lands before the re-render.
    const isAddingRef = useRef(false)

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
        return options.map(({ chainId, isEnabled, address }) => ({
            chainId,
            family: chains.get(chainId).descriptor.family,
            displayName: chainDisplayNameOf(chainId) ?? chainId,
            address: address && addressCodecs.get(chainId).truncate(address),
            isEnabled,
            canShowQr:
                isEnabled &&
                checkCapability({ chain: { chainId, capability: 'receive' } }),
        }))
    }, [options, checkCapability])

    const isCollapsed = !isShowingAll && rows.length > COLLAPSED_NETWORK_COUNT
    const visibleRows = isCollapsed
        ? rows.slice(0, COLLAPSED_NETWORK_COUNT)
        : rows
    const hiddenRows = isCollapsed ? rows.slice(COLLAPSED_NETWORK_COUNT) : []

    const handleShowAllNetworks = useCallback(() => setIsShowingAll(true), [])

    const handleToggleExpanded = useCallback((chainId: ChainId) => {
        setExpandedChainId(current =>
            current === chainId ? undefined : chainId,
        )
    }, [])

    const handleAddNetwork = useCallback(
        (chainId: ChainId) => {
            if (isAddingRef.current) return
            isAddingRef.current = true
            setAddingChainId(chainId)
            void (async () => {
                try {
                    await enableChain(account.id, chainId, 'user')
                } catch (error) {
                    if (!isMounted()) return
                    showError(error, t('account_options.add_network_error'), {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    })
                } finally {
                    isAddingRef.current = false
                    if (isMounted()) setAddingChainId(undefined)
                }
            })()
        },
        [account.id, enableChain, isMounted, showError, t],
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
        handleShowAllNetworks,
        expandedChainId,
        handleToggleExpanded,
        addingChainId,
        handleAddNetwork,
        handleCopyAddress,
        handleShowQr,
    }
}
