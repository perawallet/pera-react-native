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

import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useWebView } from '@modules/webview'
import { toValidatedBrowserUrl } from '@modules/webview/hooks/handlers'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    useWalletConnect,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useNavigation } from '@react-navigation/native'
import { useMemo, useState } from 'react'

export const useSettingsWalletConnectDetailsScreen = (
    session: WalletConnectConnection,
) => {
    const { network } = useNetwork()
    const { disconnect } = useWalletConnect(network)
    const deleteModalState = useModalState()
    const [isLoading, setIsLoading] = useState(false)
    const { pushWebView } = useWebView()
    const navigation = useNavigation()
    const accounts = useAllAccounts()
    const { showError } = useErrorToast()
    const { t } = useLanguage()

    const connectedAccounts = useMemo(() => {
        return session?.session?.accounts?.map(address =>
            accounts.find(account => account.address === address),
        )
    }, [session, accounts])

    const preferredIcon =
        session?.session?.peerMeta?.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg') ||
                icon.endsWith('.gif'),
        ) ?? session?.session?.peerMeta?.icons?.[0]

    const handleDelete = () => {
        if (!session.clientId) {
            deleteModalState.close()
            return
        }
        setIsLoading(true)
        trackEvent(WalletConnectEvent.SessionDisconnected, {
            [AnalyticsMetadataKey.DappName]:
                session.session?.peerMeta?.name ?? '',
            [AnalyticsMetadataKey.DappUrl]:
                session.session?.peerMeta?.url ?? '',
        })
        void disconnect(session.clientId, true)
            .then(() => {
                // Only leave the screen once the session is genuinely gone —
                // otherwise the user returns to a list that still shows it.
                navigation.goBack()
            })
            .catch((error: unknown) => {
                showError(error, t('common.error.title'))
            })
            .finally(() => {
                setIsLoading(false)
                deleteModalState.close()
            })
    }

    const handleOpenLink = () => {
        // peerMeta.url is dApp-asserted, never validated upstream; gate it to
        // https:// before it reaches the WebView.
        const validatedUrl = toValidatedBrowserUrl(
            session.session?.peerMeta?.url,
        )
        if (!validatedUrl) return
        pushWebView({
            id: generateOrderedUniqueId(),
            url: validatedUrl,
        })
    }

    const peerMeta = session.session?.peerMeta

    return {
        peerMeta,
        preferredIcon,
        connectedAccounts,
        isLoading,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    }
}
