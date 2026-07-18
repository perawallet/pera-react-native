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

    // Web-only: bidali-url.web.ts stamps this onto the URL for the content
    // script to parse; native's bidali-url.ts ignores it (balances are
    // embedded in the injected provider JS instead — see useBidaliTransport's
    // computeBidaliBalances, the same selector reused here so both surfaces
    // stay in sync). Frozen at mount (lazy useState initializer, never
    // updated) rather than recomputed live: on web the `url` feeds the
    // iframe's `src`, so a post-mount balance change (including the sync the
    // user's own gift-card payment triggers) would otherwise change the url
    // string and re-navigate the iframe mid/post-checkout, resetting
    // Bidali's page and the paymentSent/paymentCancelled callbacks it
    // assigned. Adjudicated M8 design: balances stamped at mount, staleness
    // accepted within the session. Native is unaffected either way — its
    // builder ignores this value, so freezing it is provably harmless there.
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
