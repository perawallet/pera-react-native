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

export const name = '@perawallet/wallet-core-walletconnect'

export * from './models'
export * from './connection'
export * from './validation/inboundRequestGate'
export * from './v1/deliver'
export * from './shared/errors'
export * from './shared/chain'
export * from './shared/constants'
export * from './shared/deeplink'
export * from './shared/uri'
export { toPeer } from './shared/peer'
export * from './v1/connection'
export * from './v1/handler'
export {
    commitSessionKey,
    createKeystoreSessionKeyStore,
    createStorageSessionKeyStore,
    type WalletConnectV1SessionKeyStore,
} from './v1/secrets'
export { importLegacyConnections } from './migration/importLegacyConnections'
export {
    useConnectorRegistryStore,
    type ConnectorRegistryStore,
} from './store/connectorRegistryStore'
