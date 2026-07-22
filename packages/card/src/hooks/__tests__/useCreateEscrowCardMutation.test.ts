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
// `@perawallet/wallet-core-signing`'s barrel (needed below for buildSiwaAuthRequest
// et al.) statically re-exports the whole `@perawallet/wallet-core-blockchain`
// surface, so the mock must carry the real module through via `importActual`
// rather than fully replacing it — a bare `{ useNetwork }` object leaves those
// other named exports undefined and ESM import validation rejects it.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useNetwork: mockUseNetwork,
    }
})

const {
    createCard,
    approveEscrowCard,
    postDelegatorLsig,
    compileAutoDrawProgram,
} = vi.hoisted(() => ({
    createCard: vi.fn(),
    approveEscrowCard: vi.fn(),
    postDelegatorLsig: vi.fn(),
    compileAutoDrawProgram: vi.fn(),
}))
vi.mock('../../api/card-creation', async () => ({
    ...(await vi.importActual('../../api/card-creation')),
    createCard,
}))
vi.mock('../../api/escrow', async () => ({
    ...(await vi.importActual('../../api/escrow')),
    approveEscrowCard,
    postDelegatorLsig,
    compileAutoDrawProgram,
}))

import { useCreateEscrowCardMutation } from '../useCreateEscrowCardMutation'
import { FundingType } from '../../models'
import { useCardStore } from '../../store'
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'
import { CardIntegrityAttestationRequiredError } from '../../api/card-creation'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

const ADDRESS = 'FUNDINGADDR'
const PROGRAM = new Uint8Array([0x06, 0x81, 0x01])

const baseVars = () => ({
    address: ADDRESS,
    signArc60: vi.fn(async () => new Uint8Array(64).fill(1)),
    signLsigProgram: vi.fn(async () => new Uint8Array([9, 9, 9])),
})

const setValidIntegrityToken = () =>
    useAppIntegrityStore.getState().setRegistration({
        integrityToken: 'TEST_INTEGRITY_TOKEN',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        keyId: 'key',
        deviceId: 'device',
    })

describe('useCreateEscrowCardMutation', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        useCardStore.getState().resetState()
        useAppIntegrityStore.getState().resetState()
        setValidIntegrityToken()
        createCard.mockResolvedValue({ cardAddress: 'ESCROW1', txId: 'TX1' })
        approveEscrowCard.mockResolvedValue({ cardAddress: 'ESCROW1' })
        compileAutoDrawProgram.mockResolvedValue(PROGRAM)
        postDelegatorLsig.mockResolvedValue({ delegatorAddress: ADDRESS })
    })

    it('Manual: signs once, creates, approves, persists, and signs no LSig', async () => {
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        expect(vars.signArc60).toHaveBeenCalledTimes(1)
        expect(createCard).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                address: ADDRESS,
                currency: 'usdc',
                signData: expect.objectContaining({ data: expect.any(String) }),
                signature: expect.any(String),
                integrityToken: 'TEST_INTEGRITY_TOKEN',
            }),
        )
        expect(approveEscrowCard).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                address: ADDRESS,
                currency: 'usdc',
                txId: 'TX1',
                signData: expect.objectContaining({ data: expect.any(String) }),
                signature: expect.any(String),
            }),
        )
        // The SAME signature is reused for both calls.
        const createCall = createCard.mock.calls[0][0]
        const approveCall = approveEscrowCard.mock.calls[0][0]
        expect(approveCall.signData).toEqual(createCall.signData)
        expect(approveCall.signature).toBe(createCall.signature)

        expect(compileAutoDrawProgram).not.toHaveBeenCalled()
        expect(postDelegatorLsig).not.toHaveBeenCalled()
        expect(vars.signLsigProgram).not.toHaveBeenCalled()
        expect(outcome).toEqual({
            cardAddress: 'ESCROW1',
            fundingType: FundingType.Manual,
            autoFundingDegraded: false,
        })
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
        expect(useCardStore.getState().escrowCardTxId).toBe('TX1')
        expect(useCardStore.getState().escrowCardApproved).toBe(true)
    })

    it('Auto: creates, approves, then compiles → signs → posts the LSig in order', async () => {
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Auto,
        })

        expect(createCard).toHaveBeenCalledTimes(1)
        expect(approveEscrowCard).toHaveBeenCalledTimes(1)
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
        const createOrder = createCard.mock.invocationCallOrder[0]
        const approveOrder = approveEscrowCard.mock.invocationCallOrder[0]
        const compileOrder = compileAutoDrawProgram.mock.invocationCallOrder[0]
        const signOrder = vars.signLsigProgram.mock.invocationCallOrder[0]
        const postOrder = postDelegatorLsig.mock.invocationCallOrder[0]
        expect(createOrder).toBeLessThan(approveOrder)
        expect(approveOrder).toBeLessThan(compileOrder)
        expect(compileOrder).toBeLessThan(signOrder)
        expect(signOrder).toBeLessThan(postOrder)

        expect(outcome).toEqual({
            cardAddress: 'ESCROW1',
            fundingType: FundingType.Auto,
            autoFundingDegraded: false,
        })
    })

    it('no valid integrity token: rejects before creating anything', async () => {
        useAppIntegrityStore.getState().resetState()
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({
                ...baseVars(),
                fundingType: FundingType.Manual,
            }),
        ).rejects.toThrow(CardIntegrityAttestationRequiredError)

        expect(createCard).not.toHaveBeenCalled()
    })

    it('create failure: rejects and leaves the store untouched', async () => {
        createCard.mockRejectedValue(new Error('create boom'))
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
        expect(approveEscrowCard).not.toHaveBeenCalled()
        expect(postDelegatorLsig).not.toHaveBeenCalled()
    })

    it('approval failure after creation: card persists unapproved, and a retry only re-signs + approves', async () => {
        approveEscrowCard.mockRejectedValueOnce(new Error('approval boom'))
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        await expect(
            result.current.mutateAsync({
                ...vars,
                fundingType: FundingType.Manual,
            }),
        ).rejects.toThrow('approval boom')

        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
        expect(useCardStore.getState().escrowCardTxId).toBe('TX1')
        expect(useCardStore.getState().escrowCardApproved).toBe(false)

        const retryOutcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        expect(createCard).toHaveBeenCalledTimes(1)
        expect(approveEscrowCard).toHaveBeenCalledTimes(2)
        expect(vars.signArc60).toHaveBeenCalledTimes(2)
        expect(retryOutcome.cardAddress).toBe('ESCROW1')
        expect(useCardStore.getState().escrowCardApproved).toBe(true)
    })

    it('LSig failure: keeps the created + approved card and degrades Auto → Manual', async () => {
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
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
        expect(useCardStore.getState().escrowCardApproved).toBe(true)
    })

    it('resume: reuses a stored, approved escrow card for the SAME account + network and skips signing + create + approve', async () => {
        useCardStore.getState().setEscrowCard({
            cardAddress: 'EXISTING_CARD',
            ownerAddress: ADDRESS,
            network: 'testnet',
            txId: 'EXISTING_TX',
        })
        useCardStore.getState().markEscrowCardApproved()
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Auto,
        })

        expect(vars.signArc60).not.toHaveBeenCalled()
        expect(createCard).not.toHaveBeenCalled()
        expect(approveEscrowCard).not.toHaveBeenCalled()
        expect(postDelegatorLsig).toHaveBeenCalledWith(
            expect.objectContaining({ cardAddress: 'EXISTING_CARD' }),
        )
        expect(outcome.cardAddress).toBe('EXISTING_CARD')
    })

    it('does NOT reuse a card created for a DIFFERENT account', async () => {
        useCardStore.getState().setEscrowCard({
            cardAddress: 'CARD_FOR_A',
            ownerAddress: 'OTHER_ACCOUNT',
            network: 'testnet',
            txId: 'TX_A',
        })
        useCardStore.getState().markEscrowCardApproved()
        createCard.mockResolvedValue({
            cardAddress: 'CARD_FOR_B',
            txId: 'TX_B',
        })
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        expect(vars.signArc60).toHaveBeenCalled()
        expect(createCard).toHaveBeenCalledWith(
            expect.objectContaining({ address: ADDRESS }),
        )
        expect(outcome.cardAddress).toBe('CARD_FOR_B')
        expect(useCardStore.getState().escrowCardAddress).toBe('CARD_FOR_B')
        expect(useCardStore.getState().escrowCardOwner).toBe(ADDRESS)
        expect(useCardStore.getState().escrowCardNetwork).toBe('testnet')
    })

    it('does NOT reuse a card created on a DIFFERENT network', async () => {
        useCardStore.getState().setEscrowCard({
            cardAddress: 'MAINNET_CARD',
            ownerAddress: ADDRESS,
            network: 'mainnet',
            txId: 'TX_MAIN',
        })
        useCardStore.getState().markEscrowCardApproved()
        createCard.mockResolvedValue({
            cardAddress: 'TESTNET_CARD',
            txId: 'TX_TEST',
        })
        const { result } = renderHook(() => useCreateEscrowCardMutation(), {
            wrapper,
        })
        const vars = baseVars()

        const outcome = await result.current.mutateAsync({
            ...vars,
            fundingType: FundingType.Manual,
        })

        expect(vars.signArc60).toHaveBeenCalled()
        expect(createCard).toHaveBeenCalledWith(
            expect.objectContaining({ network: 'testnet' }),
        )
        expect(outcome.cardAddress).toBe('TESTNET_CARD')
        expect(useCardStore.getState().escrowCardNetwork).toBe('testnet')
    })
})
