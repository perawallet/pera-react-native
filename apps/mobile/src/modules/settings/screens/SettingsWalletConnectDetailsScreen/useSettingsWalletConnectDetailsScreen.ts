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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    generateOrderedUniqueId,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useWebView } from '@modules/webview'
import { toValidatedBrowserUrl } from '@modules/webview/hooks/handlers'
import { getPreferredDappIcon } from '@modules/walletconnect/utils/dapp-icon'
import { useConnectionSettingsList } from '@modules/settings/hooks/useConnectionSettingsList'
import type { ConnectionSettingsRow } from '@modules/settings/hooks/connectionSettingsReadModel'

export type UseSettingsWalletConnectDetailsScreenResult = {
    preferredIcon: Optional<string>
    connectedAccounts: ReturnType<typeof useAllAccounts>
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

    const connectedAccounts = useMemo(
        () =>
            connection.accounts
                .map(address =>
                    accounts.find(account => account.address === address),
                )
                .filter(account => account !== undefined),
        [connection.accounts, accounts],
    )

    const preferredIcon = getPreferredDappIcon(connection.peer.icons)

    const handleDelete = () => {
        setIsLoading(true)
        trackEvent(WalletConnectEvent.SessionDisconnected, {
            [AnalyticsMetadataKey.DappName]: connection.peer.name,
            [AnalyticsMetadataKey.DappUrl]: connection.peer.url ?? '',
        })
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
        isLoading,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    }
}
