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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResolvedAddress } from '../useResolvedAddress'

const mockUseNameForAddress = vi.hoisted(() => vi.fn())
const mockCodecs = vi.hoisted(() => ({
    has: vi.fn(),
    get: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-contract', () => ({
    addressCodecs: mockCodecs,
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNameForAddressQuery: mockUseNameForAddress,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    // Defaults must mirror the real constants so the mock reproduces the
    // production 5…5 / 10…10 forms.
    SHORT_ADDRESS_LENGTH: 11,
    LONG_ADDRESS_LENGTH: 20,
    truncateAlgorandAddress: (address: string, maxLength = 11) => {
        const half = Math.floor(maxLength / 2)
        return `${address.slice(0, half)}...${address.slice(-half)}`
    },
}))

const VALID_ADDRESS = 'A'.repeat(58)
const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

describe('useResolvedAddress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the name when resolved', () => {
        mockUseNameForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })

        const { result } = renderHook(() =>
            useResolvedAddress(VALID_ADDRESS, SCOPE),
        )

        expect(result.current.displayName).toBe('alice.algo')
        expect(result.current.isNamed).toBe(true)
        expect(result.current.isResolving).toBe(false)
    })

    it("uses an Ethereum address's primary name as its display name", () => {
        mockUseNameForAddress.mockReturnValue({
            data: [{ name: 'alice.eth' }],
            isPending: false,
        })
        const scope = { chainId: 'ethereum', networkId: 'mainnet' } as const

        const { result } = renderHook(() =>
            useResolvedAddress(
                '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                scope,
            ),
        )

        expect(result.current.displayName).toBe('alice.eth')
        expect(result.current.isNamed).toBe(true)
        expect(mockUseNameForAddress).toHaveBeenCalledWith(
            scope,
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            expect.anything(),
        )
    })

    it('returns truncated address as fallback', () => {
        mockUseNameForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })

        const { result } = renderHook(() =>
            useResolvedAddress(VALID_ADDRESS, SCOPE),
        )

        expect(result.current.displayName).toContain('...')
        expect(result.current.isNamed).toBe(false)
    })

    it('uses long format when specified', () => {
        mockUseNameForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })

        const { result } = renderHook(() =>
            useResolvedAddress(VALID_ADDRESS, SCOPE, { format: 'long' }),
        )

        // Long format truncates at 20 chars (10...10)
        expect(result.current.displayName.length).toBe(23)
    })

    it('truncates a short address with the given chain codec', () => {
        mockUseNameForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })
        mockCodecs.has.mockReturnValue(true)
        mockCodecs.get.mockReturnValue({ truncate: () => '0xf39F...2266' })

        const { result } = renderHook(() =>
            useResolvedAddress(VALID_ADDRESS, {
                chainId: 'eip155:1',
                networkId: 'mainnet',
            } as never),
        )

        expect(result.current.displayName).toBe('0xf39F...2266')
    })

    it('returns full address when format is full', () => {
        mockUseNameForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })

        const { result } = renderHook(() =>
            useResolvedAddress(VALID_ADDRESS, SCOPE, { format: 'full' }),
        )

        expect(result.current.displayName).toBe(VALID_ADDRESS)
    })

    it('passes enabled option through to useNameForAddressQuery', () => {
        mockUseNameForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })

        renderHook(() =>
            useResolvedAddress(VALID_ADDRESS, SCOPE, { enabled: false }),
        )

        expect(mockUseNameForAddress).toHaveBeenCalledWith(
            { chainId: 'algorand', networkId: 'mainnet' },
            VALID_ADDRESS,
            { enabled: false },
        )
    })
})
