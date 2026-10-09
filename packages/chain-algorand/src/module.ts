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

import type { ChainModule } from '@perawallet/wallet-core-chain-contract'
import {
    algorandCapabilityDefaults,
    algorandCapabilityRestrictions,
} from './capability-defaults'
import { algorandPinnedHosts } from './blockchain/pinned-hosts'
import { algorandRemoteConfigDefaults } from './blockchain/remote-config'
import { algorandDescriptor } from './descriptor'
import { registerChain } from './register'

export const chainModule: ChainModule = {
    descriptor: algorandDescriptor,
    capabilityDefaults: algorandCapabilityDefaults,
    capabilityRestrictions: algorandCapabilityRestrictions,
    // The adapters are module-level instances that don't read the context yet.
    register: _ctx => registerChain(),
    i18nKeys: () => [],
    remoteConfigDefaults: algorandRemoteConfigDefaults,
    pinnedHosts: algorandPinnedHosts,
}
