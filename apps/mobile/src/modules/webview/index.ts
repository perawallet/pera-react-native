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

// PWWebView (`@modules/webview/browser`) and WebViewOverlay (`@modules/webview/shell`)
// mount the dApp bridge, which reaches signing, connections and deep links; the
// many consumers that only open a URL through `useWebView` must not pull that in.
export {
    useWebView,
    useWebViewStack,
    useWebViewStore,
    type WebViewRequest,
} from './hooks/useWebViewStore'
export {
    isSafeBrowserUrl,
    isSafeRelativePath,
    isTrustedWebviewOrigin,
    openValidatedBrowserUrl,
    toValidatedBrowserUrl,
} from './hooks/handlers'
export {
    resolveWebviewLanguage,
    withLanguageParam,
} from './hooks/webviewLanguage'
