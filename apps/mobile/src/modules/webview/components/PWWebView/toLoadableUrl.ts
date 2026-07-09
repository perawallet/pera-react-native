/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Ensures a webview URL is absolute so WKWebView loads it as a remote page.
 *
 * A scheme-less input (`example.com/x`) is otherwise resolved by WKWebView as a
 * path relative to the app bundle and never loads — the page just spins. Inputs
 * that already carry a scheme (`https://…`, `http://…`, custom `foo://…`) are
 * left untouched; everything else gets an `https://` prefix.
 */
export const toLoadableUrl = (url: string): string =>
    /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`
