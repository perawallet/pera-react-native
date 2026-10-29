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

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    ChainAdapterNotRegisteredError,
    createChainRegistry,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type FeeModel,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useChainFeeModel } from '../useChainFeeModel'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: vi.fn(),
}))

const FLAT_CHAIN_ID = 'flatchain' as ChainId
const GAS_CHAIN_ID = 'gaschain' as ChainId

const descriptor = (id: ChainId, feeModel: FeeModel): ChainDescriptor =>
    ({ id, networks: [], protocol: { feeModel } }) as unknown as ChainDescriptor

const noCapabilities = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
) as ChainCapabilities

describe('useChainFeeModel', () => {
    beforeEach(() => {
        const chains = createChainRegistry()
        chains.register(descriptor(FLAT_CHAIN_ID, 'flat'), noCapabilities)
        chains.register(descriptor(GAS_CHAIN_ID, 'gas'), noCapabilities)
        vi.mocked(getProvider).mockReturnValue({
            chains,
        } as unknown as ReturnType<typeof getProvider>)
    })

    it.each([
        [FLAT_CHAIN_ID, 'flat'],
        [GAS_CHAIN_ID, 'gas'],
    ] as const)('returns the fee model %s declares', (chainId, expected) => {
        const { result } = renderHook(() => useChainFeeModel(chainId))

        expect(result.current).toBe(expected)
    })

    it('throws for a chain that is not registered', () => {
        expect(() =>
            renderHook(() => useChainFeeModel('unknownchain' as ChainId)),
        ).toThrow(ChainAdapterNotRegisteredError)
    })
})
