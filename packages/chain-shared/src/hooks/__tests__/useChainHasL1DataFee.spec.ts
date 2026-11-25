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
    createChainRegistry,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useChainHasL1DataFee } from '../useChainHasL1DataFee'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: vi.fn(),
}))

const GAS_CHAIN_ID = 'gaschain' as ChainId

const descriptor = (id: ChainId, hasL1DataFee?: boolean): ChainDescriptor =>
    ({
        id,
        networks: [],
        protocol: { feeModel: 'gas', ...(hasL1DataFee && { hasL1DataFee }) },
    }) as unknown as ChainDescriptor

const noCapabilities = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
) as ChainCapabilities

describe('useChainHasL1DataFee', () => {
    const OP_STACK_ID = 'opstack' as ChainId

    beforeEach(() => {
        const chains = createChainRegistry()
        chains.register(descriptor(GAS_CHAIN_ID), noCapabilities)
        chains.register(descriptor(OP_STACK_ID, true), noCapabilities)
        vi.mocked(getProvider).mockReturnValue({
            chains,
        } as unknown as ReturnType<typeof getProvider>)
    })

    it.each([
        [OP_STACK_ID, true],
        [GAS_CHAIN_ID, false],
    ] as const)(
        'says whether %s charges an L1 data fee',
        (chainId, expected) => {
            const { result } = renderHook(() => useChainHasL1DataFee(chainId))

            expect(result.current).toBe(expected)
        },
    )
})
