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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return { ...actual, useNetwork: mockUseNetwork }
})

const { fetchDelegationToken } = vi.hoisted(() => ({
    fetchDelegationToken: vi.fn(),
}))
vi.mock('../../api/delegation', async () => ({
    ...(await vi.importActual('../../api/delegation')),
    fetchDelegationToken,
}))

import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { useSignCardOwnershipMutation } from '../useSignCardOwnershipMutation'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

const signedPayload = (data: string): Record<string, unknown> =>
    JSON.parse(new TextDecoder().decode(decodeFromBase64(data)))

describe('useSignCardOwnershipMutation', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        fetchDelegationToken.mockResolvedValue({
            token: 'ABC_tok',
            nonce: 'n0nce',
        })
    })

    it('builds and signs an ARC-60 SIWA request, base64-encoding the result', async () => {
        const signArc60 = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        const proof = await result.current.mutateAsync({
            address: 'FUNDINGADDR',
            signArc60,
        })

        expect(signArc60).toHaveBeenCalledWith(
            expect.objectContaining({
                signer: 'FUNDINGADDR',
                domain: 'perawallet.app',
                data: expect.any(String),
                authenticatorData: expect.any(Uint8Array),
            }),
            { scope: 1, encoding: 'base64' },
        )
        expect(proof.signData.data).toEqual(expect.any(String))
        expect(proof.signData.authenticatorData).toEqual(expect.any(String))
        expect(proof.signature).toEqual(expect.any(String))
    })

    it('fetches a delegation token first and embeds its nonce in the signed SIWA payload', async () => {
        const signArc60 = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        const proof = await result.current.mutateAsync({
            address: 'FUNDINGADDR',
            signArc60,
        })

        expect(fetchDelegationToken).toHaveBeenCalledWith(
            expect.objectContaining({ network: 'testnet' }),
        )
        expect(signedPayload(proof.signData.data).nonce).toBe('n0nce')
        expect(proof.delegationToken).toBe('ABC_tok')
    })

    it('does not sign when the token fetch fails', async () => {
        fetchDelegationToken.mockRejectedValue(new Error('delegation down'))
        const signArc60 = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({ address: 'FUNDINGADDR', signArc60 }),
        ).rejects.toThrow('delegation down')
        expect(signArc60).not.toHaveBeenCalled()
    })
})
