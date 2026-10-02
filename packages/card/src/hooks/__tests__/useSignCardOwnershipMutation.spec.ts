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

import {
    messageSignerChainAdapters,
    type MessageSignerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { useSignCardOwnershipMutation } from '../useSignCardOwnershipMutation'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

// The real sign-in payload is the chain's; its own specs cover it. Here the
// builder is a spy so the test pins what the mutation asks it for.
const buildSiwxAuthData = vi.fn()

const registerFakeMessageSigner = () => {
    messageSignerChainAdapters.reset()
    messageSignerChainAdapters.register({
        chainId: 'algorand',
        buildSiwxAuthData,
    } as unknown as MessageSignerChainAdapter)
}

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
        buildSiwxAuthData.mockImplementation(({ address, domain }) => ({
            authData: {
                data: 'c2lnbi1pbg==',
                signer: address,
                domain,
                authenticatorData: new Uint8Array(37).fill(3),
            },
            metadata: { scope: 1, encoding: 'base64' },
        }))
        registerFakeMessageSigner()
    })

    it('signs the chain-built sign-in request, base64-encoding the result', async () => {
        const signAuthData = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        const proof = await result.current.mutateAsync({
            address: 'FUNDINGADDR',
            signAuthData,
        })

        expect(signAuthData).toHaveBeenCalledWith(
            expect.objectContaining({
                signer: 'FUNDINGADDR',
                domain: 'perawallet.app',
                data: expect.any(String),
                authenticatorData: expect.any(Uint8Array),
            }),
            { scope: 1, encoding: 'base64' },
        )
        expect(proof.signData.data).toBe('c2lnbi1pbg==')
        expect(proof.signData.authenticatorData).toEqual(expect.any(String))
        expect(proof.signature).toEqual(expect.any(String))
    })

    it('fetches a delegation token first and builds the sign-in request around its nonce', async () => {
        const signAuthData = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        const proof = await result.current.mutateAsync({
            address: 'FUNDINGADDR',
            signAuthData,
        })

        expect(fetchDelegationToken).toHaveBeenCalledWith(
            expect.objectContaining({ network: 'testnet' }),
        )
        expect(buildSiwxAuthData).toHaveBeenCalledWith(
            expect.objectContaining({
                nonce: 'n0nce',
                domain: 'perawallet.app',
                address: 'FUNDINGADDR',
            }),
        )
        expect(proof.delegationToken).toBe('ABC_tok')
    })

    it('does not sign when the token fetch fails', async () => {
        fetchDelegationToken.mockRejectedValue(new Error('delegation down'))
        const signAuthData = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({
                address: 'FUNDINGADDR',
                signAuthData,
            }),
        ).rejects.toThrow('delegation down')
        expect(signAuthData).not.toHaveBeenCalled()
    })
})
