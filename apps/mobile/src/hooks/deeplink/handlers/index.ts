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

export { useRecoverAddressDeeplink } from './useRecoverAddressDeeplink'
export type { RecoverAddressDeeplinkHandler } from './useRecoverAddressDeeplink'
export { useSendFundsDeeplink } from './useSendFundsDeeplink'
export type {
    SendFundsDeeplinkHandler,
    SendFundsDeeplinkPrefill,
} from './useSendFundsDeeplink'
export { useKeyregDeeplink } from './useKeyregDeeplink'
export type { KeyregDeeplinkHandler } from './useKeyregDeeplink'
export { useBrowserDeeplink } from './useBrowserDeeplink'
export type { BrowserDeeplinkHandler } from './useBrowserDeeplink'
export { useDiscoverPathDeeplink } from './useDiscoverPathDeeplink'
export type { DiscoverPathDeeplinkHandler } from './useDiscoverPathDeeplink'
export { usePeraWebImportDeeplink } from './usePeraWebImportDeeplink'
export type { PeraWebImportDeeplinkHandler } from './usePeraWebImportDeeplink'
export { useAssetOptInDeeplink } from './useAssetOptInDeeplink'
export type {
    AssetOptInDeeplinkHandler,
    AssetOptInDeeplinkParams,
} from './useAssetOptInDeeplink'
export { useLocaleTourDeeplink } from './useLocaleTourDeeplink'
export type { LocaleTourDeeplinkHandler } from '@modules/locale-tour/types'
export { useWalletConnectDeeplink } from './useWalletConnectDeeplink'
export type {
    WalletConnectDeeplinkHandler,
    WalletConnectDeeplinkParams,
} from './useWalletConnectDeeplink'
