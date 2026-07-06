/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const {
    fetchDelegationToken,
    fetchDelegationProgram,
    postAlgorandDelegationApproval,
    verifyDelegationProgram,
} = vi.hoisted(() => ({
    fetchDelegationToken: vi.fn(),
    fetchDelegationProgram: vi.fn(),
    postAlgorandDelegationApproval: vi.fn(),
    verifyDelegationProgram: vi.fn(),
}))
vi.mock('../../api/delegation', () => ({
    fetchDelegationToken,
    fetchDelegationProgram,
    postAlgorandDelegationApproval,
    verifyDelegationProgram,
}))

import { useUpdateCardFundingDelegationMutation } from '../useUpdateCardFundingDelegationMutation'
import { cardQueryKeys } from '../querykeys'

const PROGRAM = new Uint8Array([0x04, 0x81, 0x01])
const SIGNED = new Uint8Array([1, 2, 3])

describe('useUpdateCardFundingDelegationMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        fetchDelegationProgram.mockResolvedValue(PROGRAM)
        fetchDelegationToken.mockResolvedValue({
            token: 'tok-1',
            nonce: 'bm9uY2U=',
        })
        postAlgorandDelegationApproval.mockResolvedValue(undefined)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    const signDelegation = vi.fn(async () => ({ signedProgram: SIGNED }))

    it('signs the fetched program and posts the base64 wire fields', async () => {
        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        await result.current.mutateAsync({
            address: 'ALGO_ADDR',
            allowance: new Decimal(400),
            signDelegation,
        })

        expect(signDelegation).toHaveBeenCalledWith(PROGRAM)
        expect(postAlgorandDelegationApproval).toHaveBeenCalledWith({
            network: 'mainnet',
            address: 'ALGO_ADDR',
            amount: '400',
            currency: 'usdc',
            token: 'tok-1',
            // base64 of [1, 2, 3]
            signedProgram: 'AQID',
            sigMessage: 'bm9uY2U=',
        })
    })

    it('sends allowance 0 as amount "0" — the cancel path', async () => {
        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        await result.current.mutateAsync({
            address: 'ALGO_ADDR',
            allowance: new Decimal(0),
            signDelegation,
        })

        expect(postAlgorandDelegationApproval).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '0' }),
        )
    })

    it('fetches the single-use token after signing so it stays fresh', async () => {
        const order: string[] = []
        fetchDelegationProgram.mockImplementation(async () => {
            order.push('program')
            return PROGRAM
        })
        fetchDelegationToken.mockImplementation(async () => {
            order.push('token')
            return { token: 'tok-1', nonce: 'bm9uY2U=' }
        })
        const trackingSigner = vi.fn(async () => {
            order.push('sign')
            return { signedProgram: SIGNED }
        })

        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        await result.current.mutateAsync({
            address: 'ALGO_ADDR',
            allowance: new Decimal(400),
            signDelegation: trackingSigner,
        })

        expect(order).toEqual(['program', 'sign', 'token'])
    })

    it('aborts before posting when the signer rejects', async () => {
        const failingSigner = vi.fn(async () => {
            throw new Error('signing unsupported')
        })

        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        result.current.mutate({
            address: 'ALGO_ADDR',
            allowance: new Decimal(400),
            signDelegation: failingSigner,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(postAlgorandDelegationApproval).not.toHaveBeenCalled()
    })

    it('verifies the fetched program before signing it', async () => {
        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        await result.current.mutateAsync({
            address: 'ALGO_ADDR',
            allowance: new Decimal(400),
            signDelegation,
        })

        expect(verifyDelegationProgram).toHaveBeenCalledWith(PROGRAM, 'mainnet')
    })

    it('aborts before signing when program verification throws', async () => {
        verifyDelegationProgram.mockImplementationOnce(() => {
            throw new Error('unpinned program')
        })
        const rejectingSigner = vi.fn()

        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        result.current.mutate({
            address: 'ALGO_ADDR',
            allowance: new Decimal(400),
            signDelegation: rejectingSigner,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(rejectingSigner).not.toHaveBeenCalled()
        expect(postAlgorandDelegationApproval).not.toHaveBeenCalled()
    })

    it('invalidates the external wallets query on success', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(
            () => useUpdateCardFundingDelegationMutation(),
            { wrapper },
        )

        await result.current.mutateAsync({
            address: 'ALGO_ADDR',
            allowance: new Decimal(400),
            signDelegation,
        })

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: cardQueryKeys.externalWallets('mainnet'),
        })
    })
})
