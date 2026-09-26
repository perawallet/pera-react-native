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

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    nameServiceChainAdapters,
    type NameServiceChainAdapter,
} from '../chain-adapter'

// Shape-only, unlike a real chain's check: these specs cover the name
// service's plumbing, not address validation.
export const fakeNameServiceAdapter = (
    overrides: Partial<NameServiceChainAdapter> = {},
): NameServiceChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    isValidAddress: address => /^[0-9a-zA-Z]{58}$/.test(address),
    ...overrides,
})

export const registerFakeNameServiceAdapter = (
    overrides: Partial<NameServiceChainAdapter> = {},
): NameServiceChainAdapter => {
    const adapter = fakeNameServiceAdapter(overrides)
    nameServiceChainAdapters.reset()
    nameServiceChainAdapters.register(adapter)
    return adapter
}
