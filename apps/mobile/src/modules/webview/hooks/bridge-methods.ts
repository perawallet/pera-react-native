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

/**
 * The protocol v3 RN <-> web bridge method set — the single source of truth
 * for the dispatch in `usePeraWebviewInterface`. Adding or removing a method
 * here requires updating docs/DISCOVER_BRIDGE_CONTRACT.md and the contract
 * test (`__tests__/bridge-methods.test.ts`) in the same change.
 */
export const PERA_WEBVIEW_BRIDGE_METHODS = [
    'canOpenURI',
    'closeWebView',
    'getAddresses',
    'getDeviceId',
    'getPublicSettings',
    'getSettings',
    'logAnalyticsEvent',
    'notifyUser',
    'onBackPressed',
    'openNativeURI',
    'openSystemBrowser',
    'pushWebView',
    'requestDataSigning',
    'requestTransactionSigning',
    'walletConnect',
] as const

export type PeraWebviewBridgeMethod =
    (typeof PERA_WEBVIEW_BRIDGE_METHODS)[number]

export const isSupportedBridgeMethod = (
    method: string,
): method is PeraWebviewBridgeMethod =>
    (PERA_WEBVIEW_BRIDGE_METHODS as readonly string[]).includes(method)
