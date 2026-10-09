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

import {
    addressCodecs,
    keyDerivations,
    type ChainModule,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumAddressCodec } from './addresses'
import { ethereumCapabilityDefaults } from './capability-defaults'
import { ethereumDescriptor } from './descriptor'
import { EVM_ERROR_I18N_KEYS } from './errors/translate'
import { ethereumKeyDerivation } from './keys/derivation'

export const ethereumModule: ChainModule = {
    descriptor: ethereumDescriptor,
    capabilityDefaults: ethereumCapabilityDefaults,
    // registerChainSetup registers the descriptor; each Ethereum adapter registers here.
    register: _ctx => {
        addressCodecs.register(ethereumAddressCodec)
        keyDerivations.register(ethereumKeyDerivation)
    },
    i18nKeys: () => EVM_ERROR_I18N_KEYS,
}
