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

// The hooks reach every handler, and the handlers import connections, webview,
// multisig and more. A caller those modules depend on imports ./core instead.
export {
    DeeplinkTimeoutError,
    DeeplinkType,
    PERAWALLET_UNIVERSAL_LINK_HOST,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
    buildDeeplink,
    isOriginGatedDeeplinkType,
    navigateToScreen,
    parseDeeplink,
    pushScreen,
} from './core'
export { useDeepLink } from './hooks/useDeepLink'
export { useDeeplinkListener } from './hooks/useDeeplinkListener'
