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

// This package's source uses the ambient `chrome` global directly (no local
// imports) — its own tsconfig lists "chrome" in `types`, but downstream
// consumers whose tsconfig does NOT (e.g. apps/mobile) still pull
// this source into their tsc program via path-aliased imports. A `types`
// list is program-wide, but an explicit triple-slash reference is honored
// regardless of the consuming project's `types` list, so this keeps the
// package self-contained without forcing "chrome" back onto every consumer.
/// <reference types="chrome" />

export const name = '@perawallet/wallet-extension-platform-chrome'

export {
    WithChromePlatformExtension,
    WithChromePlatformExtension as WithPlatformExtension,
    type ChromePlatformExtension,
} from './extension'
export {
    ChromeDeviceInfoService,
    ChromeKeyValueStorageService,
} from './services'
export { getPlatformServices, hydratePlatform } from './resources'
export { getSurface, type ExtensionSurface } from './surface'
export {
    openExpandedTab,
    closeCurrentTab,
    consumeInitialExpandedFlow,
    openExternalTab,
    type ExpandedFlow,
} from './navigation'
export { isTrustedExtensionPageSender } from './trusted-sender'
export { ensureDeviceID, DEVICE_ID_STORAGE_KEY } from './device-id'
export {
    WC_CONTROL_SCOPE,
    isWcControlMessage,
    type WcControlMessage,
    type WcDeliveryOutcome,
    WC_REQUEST_SCOPE,
    isWcApprovalRequestMessage,
    type WcApprovalRequestMessage,
    WC_PAIR_OUTCOME_SCOPE,
    isWcPairOutcomeMessage,
    type WcPairOutcome,
    type WcPairOutcomeMessage,
    isWcAck,
    type WcAck,
} from './walletconnect/protocol'
export {
    WC_PAGE_PAIR_SCOPE,
    isWcPagePairMessage,
    type WcPagePairMessage,
} from './walletconnect/page-pair'
export {
    sendWcApprovalRequest,
    onWcControlMessage,
    sendWcControlMessage,
    sendPairOutcome,
    onPairOutcome,
} from './walletconnect/client'
export {
    DB_SCOPE,
    DB_CONTROL_SCOPE,
    encodeWireValues,
    decodeWireValues,
    isDbMessage,
    type DbMessage,
    type DbExecMessage,
    type DbExecResponse,
    type DbPingResponse,
    type DbMethod,
    type EnsureOffscreenMessage,
} from './database/protocol'
export {
    DatabaseHost,
    startDatabaseHost,
    setActiveDatabaseHost,
    getActiveDatabaseHost,
    type SqlExecutor,
} from './database/host'
export { createWorkerExecutor } from './database/worker-executor'
export { onLocalStorageKeyChanged } from './storage-events'
export {
    STORAGE_PROXY_SCOPE,
    STORAGE_EVENT_SCOPE,
    startStorageProxyHost,
    installOffscreenStorageShim,
    type StorageProxyMessage,
    type StorageProxyResponse,
    type StorageChangedBroadcast,
} from './storage-proxy'
// The ARC-0027 wire/permissions/core-router types+logic now live in
// @perawallet/wallet-core-arc0027 (platform-agnostic). Re-exported here so
// existing consumers of this barrel (e.g. apps/mobile's
// useDappConnectionsStore, which reads DappPermissionStore) don't need to
// depend on the new package directly.
export * from '@perawallet/wallet-core-arc0027'
export { ChromeDappRouter } from './dapp/router'
export * from './dapp/passkey-opener'
export * from './dapp/approval-bridge'
export * from './dapp/approval-client'
export * from './dapp/webauthn-router-protocol'
export * from './dapp/passkey-router'
export {
    createDiscoverBridgeHost,
    type DiscoverBridgeHost,
} from './webview/bridge-host'
export * from './webview/bridge-wire'
