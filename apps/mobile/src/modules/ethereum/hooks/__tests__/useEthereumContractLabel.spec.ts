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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useEvmContractMetadataQuery,
    type EvmContractMetadata,
} from '@perawallet/wallet-core-chain-ethereum'
import { useEthereumContractLabel } from '../useEthereumContractLabel'

vi.mock('@perawallet/wallet-core-chain-ethereum', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-ethereum')
    >()),
    useEvmContractMetadataQuery: vi.fn(),
}))

const mockShareability = vi.hoisted(() => ({ current: { isShareable: true } }))
vi.mock('@modules/signing/hooks/useRequestShareability', () => ({
    useRequestShareability: () => mockShareability.current,
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const BUNDLED = { name: 'Aave V3 Pool', projectDomain: 'aave.com' }

const answer = (data: EvmContractMetadata | null) => {
    vi.mocked(useEvmContractMetadataQuery).mockReturnValue({
        data,
        isPending: false,
    })
}

describe('useEthereumContractLabel', () => {
    beforeEach(() => {
        answer(null)
        mockShareability.current = { isShareable: true }
    })

    it('never looks up a request naming a scam-listed address', () => {
        mockShareability.current = { isShareable: false }

        renderHook(() => useEthereumContractLabel(SCOPE, POOL, BUNDLED))

        expect(useEvmContractMetadataQuery).toHaveBeenCalledWith({
            scope: SCOPE,
            address: POOL,
            isEnabled: false,
        })
    })

    it("names the contract as Pera's curated metadata does, with its project's domain", () => {
        answer({
            name: 'Aave V3 Pool',
            projectUrl: 'https://www.aave.com/',
        })

        const { result } = renderHook(() =>
            useEthereumContractLabel(SCOPE, POOL, undefined),
        )

        expect(result.current).toEqual({
            name: 'Aave V3 Pool',
            projectDomain: 'aave.com',
        })
        expect(useEvmContractMetadataQuery).toHaveBeenCalledWith({
            scope: SCOPE,
            address: POOL,
            isEnabled: true,
        })
    })

    it('prefers the curated name over the bundled one', () => {
        answer({
            name: 'Pool V3',
            projectUrl: 'https://aave.com',
        })

        const { result } = renderHook(() =>
            useEthereumContractLabel(SCOPE, POOL, BUNDLED),
        )

        expect(result.current?.name).toBe('Pool V3')
    })

    it('falls back to the bundled entry while, or when, Pera has nothing', () => {
        const { result } = renderHook(() =>
            useEthereumContractLabel(SCOPE, POOL, BUNDLED),
        )

        expect(result.current).toBe(BUNDLED)
    })

    it('names nothing a contract neither source knows', () => {
        const { result } = renderHook(() =>
            useEthereumContractLabel(SCOPE, POOL, undefined),
        )

        expect(result.current).toBeNull()
    })

    it('names nothing and looks nothing up while disabled', () => {
        const { result } = renderHook(() =>
            useEthereumContractLabel(SCOPE, POOL, BUNDLED, false),
        )

        expect(result.current).toBeNull()
        expect(useEvmContractMetadataQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
    })
})
