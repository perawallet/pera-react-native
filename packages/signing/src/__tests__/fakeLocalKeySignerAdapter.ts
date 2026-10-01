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

import { vi } from 'vitest'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    localKeySignerChainAdapters,
    type LocalKeySignerChainAdapter,
} from '../chain-adapter'

const notStubbed = (member: string) => () => {
    throw new Error(`fake local-key signer: ${member} is not stubbed`)
}

export const fakeLocalKeySignerAdapter = (
    overrides: Partial<LocalKeySignerChainAdapter> = {},
): LocalKeySignerChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    signTransactions: vi.fn(notStubbed('signTransactions')),
    createStrategy: vi.fn(notStubbed('createStrategy')),
    signGroups: vi.fn(notStubbed('signGroups')),
    ...overrides,
})

export const registerFakeLocalKeySignerAdapter = (
    overrides: Partial<LocalKeySignerChainAdapter> = {},
): LocalKeySignerChainAdapter => {
    const adapter = fakeLocalKeySignerAdapter(overrides)
    localKeySignerChainAdapters.reset()
    localKeySignerChainAdapters.register(adapter)
    return adapter
}
