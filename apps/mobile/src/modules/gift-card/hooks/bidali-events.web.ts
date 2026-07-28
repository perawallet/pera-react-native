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

// Web twin of the native sendBidaliEvent (bidali-events.ts): native runs
// injectJavaScript against the live WebView, which has no equivalent for a
// cross-origin iframe. Here the "webview" a caller holds is the transport-
// backed bridge-webview object PWWebView.web populates webviewRef with, so
// asBridgeTransport recovers the underlying transport and posts a structured
// notification instead. The content-script listener (bidali-main.ts)
// re-dispatches this exact envelope onto window.bidaliProvider[event]().
import type WebView from 'react-native-webview'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { asBridgeTransport } from '@modules/webview/hooks/handlers.web'

export const sendBidaliEvent = (
    webviewRef: React.RefObject<Nullable<WebView>>,
    event: 'paymentSent' | 'paymentCancelled',
) => {
    // Deliberately no `id` field: this is a fire-and-forget JSON-RPC
    // notification (mirroring native's one-way injectJavaScript call) — the
    // content-script listener must not attempt request/response correlation.
    asBridgeTransport(webviewRef.current)?.postToWebview({
        jsonrpc: '2.0',
        method: 'bidaliEvent',
        params: { event },
    })
}
