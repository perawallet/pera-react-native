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

export type PWStaticWebViewSource =
    | { html: string; baseUrl?: string }
    | { uri: string }

export type PWStaticWebViewProps = {
    /** Bundled HTML (with an optional base URL) or a remote URL. */
    source: PWStaticWebViewSource
    // Web adapter ignores every WebView-specific prop; consumers pass them
    // for native. Keep the index signature out — the native file intersects
    // with WebViewProps itself.
}
