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

export const name = '@perawallet/wallet-extension-liquid-auth'

export { WithLiquidAuth } from './extension'
export { LiquidAuthServiceImpl } from './service'
export { LiquidAuthSignalClient } from './signalClient'
export { runFidoCeremony } from './ceremony'
export {
    readLiquidAuthSessionCookie,
    readLiquidAuthSessionCookieWith,
    type CookieReader,
} from './sessionCookie'
export { DEFAULT_ICE_SERVERS, DEFAULT_HEARTBEAT_INTERVAL_MS } from './constants'
export type {
    LiquidAuthExtension,
    LiquidAuthService,
    LiquidAuthDataChannel,
    SignalClientLike,
    IceServerConfig,
    FidoCeremonyInput,
    FidoCeremonyResult,
} from './types'
export { bootstrapLiquidAuth, installCredentialsPolyfill } from './bootstrap'
export type { CredentialMechanism } from './bootstrap'
export {
    createKeystoreCredentialMechanismCore,
    type KeystoreCredentialMechanism,
    type KeystoreCredentialMechanismDeps,
    type P256KeyAccess,
    type P256PublicKeyXY,
} from './keystoreCredentials'
export {
    createKeystoreCredentialMechanism,
    createKeystoreP256KeyAccess,
} from './keystoreCredentialsAdapter'
export {
    setLiquidAuthKeystoreHost,
    resetLiquidAuthKeystoreHost,
    getLiquidAuthKeystoreHost,
} from './keystoreHost'
export type {
    LiquidAuthKeystoreHost,
    LiquidAuthKeyStore,
    LiquidAuthBiometrics,
} from './keystoreHost'

// ARC-0027 wallet-RPC protocol (CBOR-over-data-channel wire, dispatcher,
// method handlers).
export {
    ARC0027_NAMESPACE,
    ARC0027_ERROR_CODES,
    type Arc0027Method,
    type Arc0027Reference,
    type Arc0027RequestEnvelope,
    type Arc0027ResponseEnvelope,
    type Arc0027ErrorCode,
    type LiquidAuthNetwork,
} from './arc0027/types'
export { Arc0027Error, toArc0027Error } from './arc0027/errors'
export {
    encodeFrame,
    decodeFrame,
    parseEnvelope,
    parseReference,
    buildResponse,
    buildErrorResponse,
} from './arc0027/codec'
export {
    createArc0027Dispatcher,
    type Arc0027Handler,
    type Arc0027Handlers,
} from './arc0027/dispatcher'
export { createDiscoverHandler, type DiscoverConfig } from './handlers/discover'
export { createEnableHandler, type EnableConfig } from './handlers/enable'
export { createDisableHandler } from './handlers/disable'
export {
    createSignTransactionsHandler,
    type SignTransactionsConfig,
} from './handlers/signTransactions'
export {
    createPostTransactionsHandler,
    createSignAndPostTransactionsHandler,
} from './handlers/postTransactions'
export {
    createSignMessageHandler,
    type EnqueueArc60,
} from './handlers/signMessage'

// WalletConnect JSON-RPC routed over the Liquid Auth data channel.
export {
    createWalletConnectRoute,
    type WalletConnectRouteConfig,
} from './walletconnect/createWalletConnectRoute'
export {
    buildWcError,
    buildWcResult,
    parseWcRequest,
    type WcRequest,
} from './walletconnect/wcCodec'

// Protocol negotiation (offer/select handshake preceding the wallet RPC).
export * from './negotiate'
