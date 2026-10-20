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

export type {
    ChainDeeplinkIntent,
    ChainDeeplinkResolution,
    ChainLinkTarget,
    DeeplinkParseFailure,
    DeeplinkParseResult,
} from './models'
export {
    ChainActionBuildError,
    deeplinkAdapters,
    DuplicateDeeplinkSchemeError,
    uriSchemeOf,
    type ChainActionBuildFailure,
    type DeeplinkChainAdapter,
} from './chain-adapter'
export { resolveChainDeeplink } from './resolve'
export { parseDeeplink } from './parser'
export {
    DeeplinkType,
    linkTargetOf,
    type AccountDetailDeeplink,
    type AddContactDeeplink,
    type AddressActionsDeeplink,
    type AddWatchAccountDeeplink,
    type AnyParsedDeeplink,
    type AssetDetailDeeplink,
    type AssetInboxDeeplink,
    type AssetOptInDeeplink,
    type AssetTransactionsDeeplink,
    type BuyDeeplink,
    type CardsDeeplink,
    type ChainActionDeeplink,
    type ChainScopedDeeplink,
    type DiscoverBrowserDeeplink,
    type DiscoverPathDeeplink,
    type EditContactDeeplink,
    type HomeDeeplink,
    type InternalBrowserDeeplink,
    type LiquidAuthDeeplink,
    type LinkSource,
    type ParsedDeeplink,
    type PeraWebImportDeeplink,
    type ReceiverAccountSelectionDeeplink,
    type RecoverAddressDeeplink,
    type SellDeeplink,
    type SharedAccountImportDeeplink,
    type SignRequestDeeplink,
    type StakingDeeplink,
    type SwapDeeplink,
    type TransferDeeplink,
    type WalletConnectDeeplink,
} from './links'
export { isNotificationAllowedDeeplinkType } from './notification-policy'
export { isOriginGatedDeeplinkType } from './page-initiated-policy'
export {
    chainRequirementOf,
    DEEPLINK_CHAIN_CAPABILITY,
    unsupportedLinkChainOf,
    type DeeplinkChainCapability,
    type DeeplinkChainRequirement,
} from './capability-policy'
export {
    addressCandidatesOf,
    isUnsupportedChainLink,
    linkNetworkMismatchOf,
    unsupportedActionChainOf,
    type AddressCandidates,
} from './link-routing'
export { buildDeeplink, type BuildDeeplinkInput } from './builders'
export {
    PERAWALLET_SCHEME,
    PERAWALLET_UNIVERSAL_LINK_HOST,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
} from './constants'
export {
    getUniversalLinkPath,
    isPeraOwnedDeeplink,
    normalizeUrl,
    parseQueryParams,
    readPeraAppLink,
} from './utils'
export { walletConnectUriOf } from './wallet-connect'
export {
    peraLinkChainFailure,
    type PeraLinkChainFailure,
} from './pera-link-chain'
export { readScannedAddress, type ScannedAddress } from './scanned-address'
