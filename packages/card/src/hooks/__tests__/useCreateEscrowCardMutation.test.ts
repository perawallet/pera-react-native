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
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { createEscrowCard, postDelegatorLsig, compileAutoDrawProgram } =
    vi.hoisted(() => ({
        createEscrowCard: vi.fn(),
        postDelegatorLsig: vi.fn(),
        compileAutoDrawProgram: vi.fn(),
    }))
vi.mock('../../api/escrow', async () => ({
    ...(await vi.importActual('../../api/escrow')),
    createEscrowCard,
    postDelegatorLsig,
    compileAutoDrawProgram,
}))

import { useCreateEscrowCardMutation } from '../useCreateEscrowCardMutation'
import { FundingType } from '../../models'
import { useCardStore } from '../../store'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

const ADDRESS = 'FUNDINGADDR'
const PROGRAM = new Uint8Array([0x06, 0x81, 0x01])

const baseVars = () => ({
    address: ADDRESS,
    signSiwaMessage: vi.fn(async () => new Uint8Array(64).fill(1)),
    signLsigProgram: vi.fn(async () => new Uint8Array([9, 9, 9])),
})

describe('useCreateEscrowCardMutation', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        useCardStore.getState().resetState()
        createEscrowCard.mockResolvedValue({ cardAddress: 'ESCROW1' })
        compileAutoDrawProgram.mockResolvedValue(PROGRAM)
        postDelegatorLsig.mockResolvedValue({ delegatorAddress: ADDRESS })
    })

    it('Manual: creates the card, persists it, and signs no LSig', async () => {
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        expect(vars.signSiwaMessage).toHaveBeenCalledTimes(1)
        expect(createEscrowCard).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                address: ADDRESS,
                currency: 'usdc',
                signData: expect.objectContaining({ data: expect.any(String) }),
                signature: expect.any(String),
            }),
        )
        expect(compileAutoDrawProgram).not.toHaveBeenCalled()
        expect(postDelegatorLsig).not.toHaveBeenCalled()
        expect(vars.signLsigProgram).not.toHaveBeenCalled()
        expect(outcome).toEqual({
            cardAddress: 'ESCROW1',
            fundingType: FundingType.Manual,
            autoFundingDegraded: false,
        })
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
    })

    it('Auto: creates the card, then compiles → signs → posts the LSig in order', async () => {
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Auto,
        })

        expect(createEscrowCard).toHaveBeenCalledTimes(1)
        expect(compileAutoDrawProgram).toHaveBeenCalledTimes(1)
        expect(vars.signLsigProgram).toHaveBeenCalledWith(PROGRAM)
        expect(postDelegatorLsig).toHaveBeenCalledWith(
            expect.objectContaining({
                token: 'usdc',
                delegatorAddress: ADDRESS,
                cardAddress: 'ESCROW1',
                lsigBytes: expect.any(String),
            }),
        )
        // create → compile → sign → post.
        const createOrder = createEscrowCard.mock.invocationCallOrder[0]
        const compileOrder = compileAutoDrawProgram.mock.invocationCallOrder[0]
        const signOrder = vars.signLsigProgram.mock.invocationCallOrder[0]
        const postOrder = postDelegatorLsig.mock.invocationCallOrder[0]
        expect(createOrder).toBeLessThan(compileOrder)
        expect(compileOrder).toBeLessThan(signOrder)
        expect(signOrder).toBeLessThan(postOrder)

        expect(outcome).toEqual({
            cardAddress: 'ESCROW1',
            fundingType: FundingType.Auto,
            autoFundingDegraded: false,
        })
    })

    it('create failure: rejects and leaves the store untouched', async () => {
        createEscrowCard.mockRejectedValue(new Error('create boom'))
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({
                ...baseVars(),
                fundingType: FundingType.Manual,
            }),
        ).rejects.toThrow('create boom')

        expect(useCardStore.getState().escrowCardAddress).toBeNull()
        expect(postDelegatorLsig).not.toHaveBeenCalled()
    })

    it('LSig failure: keeps the created card and degrades Auto → Manual', async () => {
        postDelegatorLsig.mockRejectedValue(new Error('lsig boom'))
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })

        const outcome = await result.current.mutateAsync({
            ...baseVars(),
            fundingType: FundingType.Auto,
        })

        expect(outcome).toEqual({
            cardAddress: 'ESCROW1',
            fundingType: FundingType.Manual,
            autoFundingDegraded: true,
        })
        // The card is real and persisted despite the LSig failure.
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
    })

    it('resume: reuses a stored escrow card for the SAME account + network and skips SIWA + create', async () => {
        useCardStore.getState().setEscrowCard({
            cardAddress: 'EXISTING_CARD',
            ownerAddress: ADDRESS,
            network: 'testnet',
        })
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Auto,
        })

        expect(vars.signSiwaMessage).not.toHaveBeenCalled()
        expect(createEscrowCard).not.toHaveBeenCalled()
        // But the Auto LSig leg still runs against the existing card.
        expect(postDelegatorLsig).toHaveBeenCalledWith(
            expect.objectContaining({ cardAddress: 'EXISTING_CARD' }),
        )
        expect(outcome.cardAddress).toBe('EXISTING_CARD')
    })

    it('does NOT reuse a card created for a DIFFERENT account', async () => {
        // A card left over from account A must not be reused for account B —
        // B has to prove ownership and get its own card.
        useCardStore.getState().setEscrowCard({
            cardAddress: 'CARD_FOR_A',
            ownerAddress: 'OTHER_ACCOUNT',
            network: 'testnet',
        })
        createEscrowCard.mockResolvedValue({ cardAddress: 'CARD_FOR_B' })
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars() // address = ADDRESS ('FUNDINGADDR')

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        // A fresh SIWA proof + create ran for the current account.
        expect(vars.signSiwaMessage).toHaveBeenCalledTimes(1)
        expect(createEscrowCard).toHaveBeenCalledWith(
            expect.objectContaining({ address: ADDRESS }),
        )
        expect(outcome.cardAddress).toBe('CARD_FOR_B')
        // The store now binds the new card to the current account + network.
        expect(useCardStore.getState().escrowCardAddress).toBe('CARD_FOR_B')
        expect(useCardStore.getState().escrowCardOwner).toBe(ADDRESS)
        expect(useCardStore.getState().escrowCardNetwork).toBe('testnet')
    })

    it('does NOT reuse a card created on a DIFFERENT network', async () => {
        // Same account, but the stored card lives on the other network —
        // the escrow service, app ids, and the card itself don't exist there,
        // so a fresh proof + create must run on the current network.
        useCardStore.getState().setEscrowCard({
            cardAddress: 'MAINNET_CARD',
            ownerAddress: ADDRESS,
            network: 'mainnet',
        })
        createEscrowCard.mockResolvedValue({ cardAddress: 'TESTNET_CARD' })
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars() // network mocked as 'testnet'

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        expect(vars.signSiwaMessage).toHaveBeenCalledTimes(1)
        expect(createEscrowCard).toHaveBeenCalledWith(
            expect.objectContaining({ network: 'testnet' }),
        )
        expect(outcome.cardAddress).toBe('TESTNET_CARD')
        expect(useCardStore.getState().escrowCardNetwork).toBe('testnet')
    })
})
