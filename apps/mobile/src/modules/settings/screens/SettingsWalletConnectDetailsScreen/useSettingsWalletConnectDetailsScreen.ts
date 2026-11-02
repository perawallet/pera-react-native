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

import { useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    findAccountByAddressOn,
    useAllAccounts,
    useRegisteredChainIds,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainId,
    type ChainNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    generateOrderedUniqueId,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
    type WalletConnectVersion,
} from '@analytics'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useWebView, toValidatedBrowserUrl } from '@modules/webview'
import {
    getPreferredDappIcon,
    toConnectionPermissions,
    uniqueChainIds,
    type ConnectionPermission,
} from '@modules/walletconnect'
import { useConnectionSettingsList } from '@modules/settings/hooks/useConnectionSettingsList'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'

// The analytics dimension is a string enum; the row carries the badge number.
const wcVersionFor = (
    protocolVersion: Optional<number>,
): Optional<WalletConnectVersion> => {
    if (protocolVersion === 1) return '1'
    if (protocolVersion === 2) return '2'
    return undefined
}

export type ConnectedNetworkLabel = {
    key: string
    chainId: ChainId
    chainName: string
    /** The network's own name, as its chain lists it. */
    label: string
    tone: 'mainnet' | 'testnet' | 'other'
}

export type ConnectedAccountRow = {
    account: WalletAccount
    /** The first chain of the session the account was found on; its address is the one shown. */
    chainId: ChainId
    networks: ConnectedNetworkLabel[]
}

const toneOf = (network: ChainNetwork): ConnectedNetworkLabel['tone'] => {
    if (network.tier === 'mainnet') return 'mainnet'
    return network.isDefaultForTier ? 'testnet' : 'other'
}

/**
 * One row per wallet account the session holds, with the networks it is
 * usable on. A scope whose network the chain's descriptor does not list (an
 * Algorand `custom` slot, which names a node and not a network a user picks)
 * is left out.
 */
const toConnectedAccountRows = (
    scopes: readonly ChainScope[],
    addresses: readonly string[],
    accounts: readonly WalletAccount[],
): ConnectedAccountRow[] => {
    const { chains } = getProvider()
    const rows = new Map<
        string,
        {
            account: WalletAccount
            chainId: ChainId
            labels: Map<string, ConnectedNetworkLabel>
        }
    >()
    for (const scope of scopes) {
        if (!chains.has(scope.chainId)) continue
        const { descriptor } = chains.get(scope.chainId)
        const network = descriptor.networks.find(
            ({ id }) => id === scope.networkId,
        )
        if (!network) continue
        const key = toScopeKey(scope)
        const label = {
            key,
            chainId: scope.chainId,
            chainName: descriptor.displayName,
            label: network.displayName,
            tone: toneOf(network),
        }
        for (const address of addresses) {
            const account = findAccountByAddressOn(
                accounts,
                scope.chainId,
                address,
            )
            if (!account) continue
            const row = rows.get(account.id) ?? {
                account,
                chainId: scope.chainId,
                labels: new Map(),
            }
            row.labels.set(key, label)
            rows.set(account.id, row)
        }
    }
    return [...rows.values()].map(({ account, chainId, labels }) => ({
        account,
        chainId,
        networks: [...labels.values()],
    }))
}

export type UseSettingsWalletConnectDetailsScreenResult = {
    preferredIcon: Optional<string>
    connectedAccounts: ConnectedAccountRow[]
    permissions: ConnectionPermission[]
    isLoading: boolean
    deleteModalState: ReturnType<typeof useModalState>
    handleDelete: () => void
    handleOpenLink: () => void
}

export const useSettingsWalletConnectDetailsScreen = (
    connection: ConnectionSettingsRow,
): UseSettingsWalletConnectDetailsScreenResult => {
    const { revoke } = useConnectionSettingsList()
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const deleteModalState = useModalState()
    const [isLoading, setIsLoading] = useState(false)
    const { pushWebView } = useWebView()
    const navigation = useNavigation()
    const accounts = useAllAccounts()
    // A session listing no network still logs its disconnect once.
    const fallbackChainId = useRegisteredChainIds()[0]

    const connectedAccounts = useMemo(
        () =>
            toConnectedAccountRows(
                connection.networks,
                connection.accounts,
                accounts,
            ),
        [connection.networks, connection.accounts, accounts],
    )

    const preferredIcon = getPreferredDappIcon(connection.peer.icons)
    const permissions = useMemo(
        () => toConnectionPermissions(connection.permissions),
        [connection.permissions],
    )

    const handleDelete = () => {
        setIsLoading(true)
        // Firebase params are scalars, so a session spanning chains logs once per chain.
        for (const chainId of uniqueChainIds(
            connection.networks.map(network => network.chainId),
            fallbackChainId,
        )) {
            trackEvent(WalletConnectEvent.SessionDisconnected, {
                [AnalyticsMetadataKey.DappName]: connection.peer.name,
                [AnalyticsMetadataKey.DappUrl]: connection.peer.url ?? '',
                // Not the session topic: `WcSessionTopic` would identify one
                // user's live session in the analytics pipeline.
                [AnalyticsMetadataKey.WcVersion]: wcVersionFor(
                    connection.protocolVersion,
                ),
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
        }
        void revoke(connection.id)
            .then(() => {
                // Only leave the screen once the session is genuinely gone —
                // otherwise the user returns to a list that still shows it.
                navigation.goBack()
            })
            .catch((error: unknown) => {
                showError(
                    error,
                    t('walletconnect.settings.disconnect_failed_title'),
                )
            })
            .finally(() => {
                setIsLoading(false)
                deleteModalState.close()
            })
    }

    const handleOpenLink = () => {
        // The peer url is dApp-asserted, never validated upstream; gate it to
        // https:// before it reaches the WebView.
        const validatedUrl = toValidatedBrowserUrl(connection.peer.url)
        if (!validatedUrl) return
        pushWebView({
            id: generateOrderedUniqueId(),
            url: validatedUrl,
        })
    }

    return {
        preferredIcon,
        connectedAccounts,
        permissions,
        isLoading,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    }
}
