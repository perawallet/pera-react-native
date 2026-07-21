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

// Web has no injectedJavaScript channel into the cross-origin Bidali iframe
// (react-native-webview's inject API doesn't exist there — see the web
// shims layer), so the balances native embeds inline in the provider JS
// (buildBidaliProviderJS in useBidaliTransport.ts) are stamped onto the URL
// instead. The content script (bidali-main.ts) parses `peraBidaliBalances`
// back out with URLSearchParams and installs it as
// window.bidaliProvider.balances, so the shape here must match native's
// balanceMap exactly.
export type BuildBidaliUrlParams = {
    baseUrl: string
    apiKey: string
    balances?: Record<string, string>
}

const BALANCES_PARAM = 'peraBidaliBalances'

export const buildBidaliUrl = ({
    baseUrl,
    apiKey,
    balances = {},
}: BuildBidaliUrlParams): string =>
    `${baseUrl}?key=${apiKey}&${BALANCES_PARAM}=${encodeURIComponent(
        JSON.stringify(balances),
    )}`
