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
import { useSignCardOwnershipMutation } from '../useSignCardOwnershipMutation'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('useSignCardOwnershipMutation', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
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

    it('produces a fresh nonce (different data) on each call', async () => {
        const signArc60 = vi.fn(async () => new Uint8Array(64).fill(7))
        const { result } = renderHook(() => useSignCardOwnershipMutation(), {
            wrapper,
        })

        const first = await result.current.mutateAsync({
            address: 'FUNDINGADDR',
            signArc60,
        })
        const second = await result.current.mutateAsync({
            address: 'FUNDINGADDR',
            signArc60,
        })

        expect(first.signData.data).not.toBe(second.signData.data)
    })
})
