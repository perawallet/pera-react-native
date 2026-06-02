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
export type { DisplayIdentity } from '@perawallet/wallet-extension-liquid-auth'
export { LIQUID_AUTH_PROVIDER_ID, LIQUID_AUTH_PROVIDER_NAME } from './constants'
export {
    buildArc60SignRequest,
    type Arc60Callbacks,
    type BuildArc60Input,
} from './utils/buildArc60SignRequest'
export {
    ALGORAND_GENESIS,
    liquidAuthNetworksForCurrent,
} from './utils/networks'
export { useLiquidAuthStore } from './store/store'
export { useLiquidAuthRegistryStore } from './store/registryStore'
export { disconnectAllLiquidAuthSessions } from './disconnectAllSessions'
export { getLiquidAuthService } from './hooks/getLiquidAuthService'
export { useLiquidAuth } from './hooks/useLiquidAuth'
export type {
    ConnectInput,
    UseLiquidAuthConfig,
    UseLiquidAuthResult,
} from './hooks/useLiquidAuth'
