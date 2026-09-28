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

// The dependency-free half of the module, for callers the handlers reach back
// into (connections, webview, messages, multisig). Nothing here may import a
// handler or a hook, or those callers close a cycle through it.
export { buildDeeplink } from './builders'
export {
    PERAWALLET_UNIVERSAL_LINK_HOST,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
} from './constants'
export { DeeplinkTimeoutError } from './handlers/timeout'
export { navigateToScreen, pushScreen } from './navigateToScreen'
export { isOriginGatedDeeplinkType } from './page-initiated-policy'
export { parseDeeplink } from './parser'
export { DeeplinkType } from './types'
