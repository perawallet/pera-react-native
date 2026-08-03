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
import { Linking } from 'react-native'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { useAccountBalancesQuery } from '@perawallet/wallet-core-accounts'
// Imported from the handlers file directly (not the module barrel) so this
// hook doesn't drag the whole webview stack into its dependency graph.
import { isTrustedWebviewOrigin } from '@modules/webview/hooks/handlers'
import { useBidali } from '../../hooks/useBidali'
import { useBidaliClose } from '../../hooks/useBidaliClose'
import {
    useBidaliTransport,
    computeBidaliBalances,
} from '../../hooks/useBidaliTransport'
import { buildBidaliUrl } from './bidali-url'
import type WebView from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseBidaliWebViewScreenResult = {
    url: string
    bidaliProviderJS: string
    onClose: () => void
    handleMessage: (data: unknown) => void
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean
    webviewRef: React.RefObject<Nullable<WebView>>
}

export const useBidaliWebViewScreen = (): UseBidaliWebViewScreenResult => {
    const { selectedAccount } = useBidali()
    const onClose = useBidaliClose()
    const { network } = useNetwork()

    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
        !!selectedAccount,
    )

    const { providerJS, handleMessage, webviewRef } = useBidaliTransport(
        selectedAccount,
        accountBalances,
    )

    // Web stamps this onto the URL for the content script; native ignores it
    // and embeds balances in the injected provider JS instead.
    //
    // Frozen at mount, not recomputed: on web the url feeds the iframe `src`,
    // so a post-mount balance change (including the sync the user's own payment
    // triggers) would re-navigate the iframe mid-checkout, resetting Bidali's
    // page and the callbacks it assigned. Staleness within a session is
    // accepted; native is unaffected since its builder ignores this.
    const [frozenBalances] = useState(() =>
        computeBidaliBalances(selectedAccount, accountBalances, network),
    )

    const url = useMemo(() => {
        const networkConfig = getNetworkConfig(network)
        return buildBidaliUrl({
            baseUrl: networkConfig.bidaliBaseUrl,
            apiKey: networkConfig.bidaliApiKey,
            balances: frozenBalances,
        })
    }, [network, frozenBalances])

    // The provider global (API key + user balances) is re-injected into the
    // main frame on every navigation, so no foreign origin may ever load in
    // this webview. Bidali hands external links out via the openUrl RPC — a
    // stray off-origin web navigation gets the same treatment (system
    // browser); everything else is dropped.
    const onShouldStartLoadWithRequest = useCallback(
        (request: ShouldStartLoadRequest): boolean => {
            if (isTrustedWebviewOrigin(request.url, [url])) return true
            if (/^https?:/i.test(request.url)) {
                void Linking.openURL(request.url)
            }
            return false
        },
        [url],
    )

    return {
        url,
        bidaliProviderJS: providerJS,
        onClose,
        handleMessage,
        onShouldStartLoadWithRequest,
        webviewRef,
    }
}
