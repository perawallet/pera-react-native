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
