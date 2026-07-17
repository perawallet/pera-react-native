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

// Web shim for react-native-webview. The real package's own web-fallback
// module crashes at bundle-eval time on web (a broken interopRequireDefault
// dependency resolves to a non-callable shape — "TypeError: t is not a
// function" — killing AppShell.web before onboarding mounts; see Task 5
// report). `WebView` is still imported at runtime by ModelViewerBottomSheet
// and PWWebView. PWWebView's surfaces (Discover/gift-card/webview-overlay)
// are off-capability on web (M6/M8), and the collectible 3D-model viewer is
// gated off `inAppWebView` on web too (useCollectibleDetail drops model
// media from the carousel when the capability is off) — only the module
// import needs to survive eval. The M6 iframe adapter (PWWebView.web) is the
// real web path for in-app browsing; until then this throws loud on render
// rather than silently no-op'ing a webview mount.
const WebView = () => {
    throw new Error(
        'react-native-webview is unavailable on web — the M6 iframe adapter (PWWebView.web) is the web path; see metro.config.js webStubs',
    )
}

export { WebView }
export default WebView
