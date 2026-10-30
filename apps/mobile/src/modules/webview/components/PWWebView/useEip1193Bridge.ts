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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type WebView from 'react-native-webview'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { eip155ChainIds } from '@perawallet/wallet-core-dapp'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    isEip1193PageMessage,
    webViewDappTransport,
    type WebViewDappPage,
} from '../../utils/webViewDappTransport'
import {
    joinWebViewScripts,
    type WebViewScript,
} from '../../utils/webViewScript'
import { eip1193ProviderJS } from './eip1193-injected-script'

export type UseEip1193BridgeArgs = {
    webview: React.RefObject<Nullable<WebView>>
    bridgeToken: string
    isEnabled: boolean
}

export type UseEip1193BridgeResult = {
    /** Undefined when the page gets no EVM provider: disabled, or no EVM chain accepts dApp connections. */
    injectedScript: Optional<WebViewScript>
    /** True when `data` was an EIP-1193 page message, so the caller must not route it elsewhere. */
    handleMessage: (data: unknown, sourceUrl: string) => boolean
    trackNavigation: (url: string) => void
}

export const useEip1193Bridge = ({
    webview,
    bridgeToken,
    isEnabled,
}: UseEip1193BridgeArgs): UseEip1193BridgeResult => {
    const checkCapability = useChainCapabilityCheck()
    const isActive =
        isEnabled &&
        eip155ChainIds().some(chainId =>
            checkCapability({ chain: { chainId, capability: 'dappConnect' } }),
        )

    const urlRef = useRef('')
    const page = useMemo<WebViewDappPage>(
        () => ({
            currentUrl: () => urlRef.current,
            // Re-joined so the lint rule sees a serializer-built script at the sink.
            inject: script =>
                webview.current?.injectJavaScript(joinWebViewScripts(script)),
        }),
        [webview],
    )

    useEffect(
        () => (isEnabled ? webViewDappTransport.attach(page) : undefined),
        [isEnabled, page],
    )

    const injectedScript = useMemo(
        () => (isActive ? eip1193ProviderJS(bridgeToken) : undefined),
        [isActive, bridgeToken],
    )

    const handleMessage = useCallback(
        (data: unknown, sourceUrl: string): boolean => {
            if (!isEip1193PageMessage(data)) return false
            urlRef.current = sourceUrl
            // Forwarded even once the capability is off: the handler then
            // answers 4900, so a page injected before that never hangs.
            if (isEnabled) webViewDappTransport.receive(page, data, sourceUrl)
            return true
        },
        [isEnabled, page],
    )

    const trackNavigation = useCallback((url: string) => {
        urlRef.current = url
    }, [])

    return useMemo(
        () => ({ injectedScript, handleMessage, trackNavigation }),
        [injectedScript, handleMessage, trackNavigation],
    )
}
