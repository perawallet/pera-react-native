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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { customNodeAdapters, type CustomNodeAdapter } from '../../custom-node'
import { useChainCapability } from '../useChainCapability'
import { useCustomNode } from '../useCustomNode'

vi.mock('../useChainCapability', () => ({
    useChainCapability: vi.fn(),
}))

const chainId = 'test:chain' as ChainId

const adapter: CustomNodeAdapter = {
    chainId,
    read: () => undefined,
    save: vi.fn(),
    fetchGenesis: vi.fn(),
}

describe('useCustomNode', () => {
    beforeEach(() => {
        customNodeAdapters.reset()
    })

    afterEach(() => {
        customNodeAdapters.reset()
    })

    it('returns the registered adapter while customNetworks is on', () => {
        vi.mocked(useChainCapability).mockReturnValue(true)
        customNodeAdapters.register(adapter)

        const { result } = renderHook(() => useCustomNode(chainId))

        expect(useChainCapability).toHaveBeenCalledWith(
            chainId,
            'customNetworks',
        )
        expect(result.current).toBe(adapter)
    })

    it('returns null while customNetworks is off', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)
        customNodeAdapters.register(adapter)

        const { result } = renderHook(() => useCustomNode(chainId))

        expect(result.current).toBeNull()
    })

    it('returns null when no adapter is registered for the chain', () => {
        vi.mocked(useChainCapability).mockReturnValue(true)

        const { result } = renderHook(() => useCustomNode(chainId))

        expect(result.current).toBeNull()
    })
})
