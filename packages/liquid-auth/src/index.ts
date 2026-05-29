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

export const name = '@perawallet/wallet-core-liquid-auth'

export * from './models'
export * from './errors'
export * from './arc0027/types'
export { Arc0027Error } from './arc0027/errors'
export {
    createArc0027Dispatcher,
    type Arc0027Handler,
    type Arc0027Handlers,
} from './arc0027/dispatcher'
export { useLiquidAuthStore } from './store/store'
export { useLiquidAuthRegistryStore } from './store/registryStore'
export { findCredentialId } from './utils/findCredentialId'
export { useLiquidAuthService } from './hooks/useLiquidAuthService'
export { useLiquidAuth } from './hooks/useLiquidAuth'
export type {
    ConnectInput,
    UseLiquidAuthConfig,
    UseLiquidAuthResult,
} from './hooks/useLiquidAuth'
