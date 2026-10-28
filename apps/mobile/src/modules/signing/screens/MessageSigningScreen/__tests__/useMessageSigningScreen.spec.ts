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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMessageSigningScreen } from '../useMessageSigningScreen'

type MockPipeline = {
    currentRequest: unknown
    resolved: unknown
    isLoading: boolean
    next: () => void
    fail: () => void
}

const mockPipeline: MockPipeline = {
    currentRequest: null,
    resolved: null,
    isLoading: false,
    next: vi.fn(),
    fail: vi.fn(),
}

const mockSigningStarted = vi.hoisted(() => ({ current: null as unknown }))
const mockReviewedMessageAddressesOf = vi.hoisted(() =>
    vi.fn((_request: unknown): unknown[] => []),
)
const mockAddressSafety = vi.hoisted(() => ({
    isConfirmBlocked: false,
    addresses: undefined as unknown,
}))

vi.mock('../../../hooks/useRequestAddressSafety', () => ({
    useRequestAddressSafety: ({ addresses }: { addresses: unknown }) => {
        mockAddressSafety.addresses = addresses
        return { isConfirmBlocked: mockAddressSafety.isConfirmBlocked }
    },
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningPipeline: () => mockPipeline,
        reviewedMessageAddressesOf: mockReviewedMessageAddressesOf,
        useLastSigningEvent: () => mockSigningStarted.current,
    }
})

const SUMMARY = {
    kind: 'text',
    title: { key: 'signing.arbitrary_data_view.body' },
    preview: 'hello',
}
const SIGNER_ACCOUNT = { id: 'account-1' }
const SOURCE = { name: 'Fixture dApp' }
const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' }

describe('useMessageSigningScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSigningStarted.current = null
        mockAddressSafety.isConfirmBlocked = false
        mockAddressSafety.addresses = undefined
        mockReviewedMessageAddressesOf.mockReturnValue([])
        mockPipeline.isLoading = false
        mockPipeline.currentRequest = {
            id: 'req-1',
            type: 'message',
            message: { scope: SCOPE },
            sourceMetadata: SOURCE,
            verifiedOrigin: 'https://dapp.example',
        }
        mockPipeline.resolved = {
            signerAccount: SIGNER_ACCOUNT,
            kind: { type: 'message', summary: SUMMARY },
        }
    })

    it('reads the summary and the signer account from the resolved request', () => {
        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.summary).toBe(SUMMARY)
        expect(result.current.signerAccount).toBe(SIGNER_ACCOUNT)
    })

    it('checks every address the message names and holds approval until it is acknowledged', () => {
        const named = [{ address: '0xSPENDER', role: 'spender' }]
        mockReviewedMessageAddressesOf.mockReturnValue(named)
        mockAddressSafety.isConfirmBlocked = true

        const { result } = renderHook(() => useMessageSigningScreen())
        act(() => result.current.handleApprove())

        expect(mockReviewedMessageAddressesOf).toHaveBeenCalledWith({
            scope: SCOPE,
        })
        expect(result.current.reviewedAddresses).toEqual(named)
        expect(mockAddressSafety.addresses).toEqual(named)
        expect(result.current.isConfirmBlocked).toBe(true)
        expect(mockPipeline.next).not.toHaveBeenCalled()
    })

    it('checks no address for a request that is not a message', () => {
        mockPipeline.currentRequest = { id: 'req-2', type: 'transactions' }

        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.reviewedAddresses).toEqual([])
        expect(mockReviewedMessageAddressesOf).not.toHaveBeenCalled()
    })

    it("reads the message request's scope", () => {
        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.scope).toBe(SCOPE)
    })

    it('has no scope for a request that is not a message', () => {
        mockPipeline.currentRequest = { id: 'req-2', type: 'arbitrary-data' }

        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.scope).toBeNull()
    })

    it('carries the requesting source and its verified origin', () => {
        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.sourceMetadata).toBe(SOURCE)
        expect(result.current.verifiedOrigin).toBe('https://dapp.example')
    })

    it('has no summary for a request that is not a message', () => {
        mockPipeline.resolved = {
            signerAccount: SIGNER_ACCOUNT,
            kind: { type: 'arbitrary-data', isSingle: true },
        }

        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.summary).toBeNull()
    })

    it('approves through the pipeline', () => {
        const { result } = renderHook(() => useMessageSigningScreen())

        act(() => result.current.handleApprove())

        expect(mockPipeline.next).toHaveBeenCalledTimes(1)
        expect(mockPipeline.fail).not.toHaveBeenCalled()
    })

    it('rejects through the pipeline', () => {
        const { result } = renderHook(() => useMessageSigningScreen())

        act(() => result.current.handleReject())

        expect(mockPipeline.fail).toHaveBeenCalledTimes(1)
        expect(mockPipeline.next).not.toHaveBeenCalled()
    })

    it('is pending while the pipeline loads', () => {
        mockPipeline.isLoading = true

        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.isPending).toBe(true)
    })

    it('is pending as soon as signing starts, before the pipeline reports loading', () => {
        mockSigningStarted.current = { type: 'signing-started' }

        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.isPending).toBe(true)
    })

    it('is idle otherwise', () => {
        const { result } = renderHook(() => useMessageSigningScreen())

        expect(result.current.isPending).toBe(false)
    })
})
