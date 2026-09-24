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

const { createCard, postAlgorandDelegationApproval, fetchUser } = vi.hoisted(
    () => ({
        createCard: vi.fn(),
        postAlgorandDelegationApproval: vi.fn(),
        fetchUser: vi.fn(),
    }),
)
vi.mock('../../api/card-creation', async () => ({
    ...(await vi.importActual('../../api/card-creation')),
    createCard,
}))
vi.mock('../../api/delegation', async () => ({
    ...(await vi.importActual('../../api/delegation')),
    postAlgorandDelegationApproval,
}))
vi.mock('../../api/user', async () => ({
    ...(await vi.importActual('../../api/user')),
    fetchUser,
}))

const { buildEnv } = vi.hoisted(() => ({
    buildEnv: { appEnvironment: 'production' },
}))
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual = await importOriginal<{ config: object }>()
    return {
        ...actual,
        config: {
            ...actual.config,
            get appEnvironment() {
                return buildEnv.appEnvironment
            },
        },
    }
})

import { useCreateAndApproveCardMutation } from '../useCreateAndApproveCardMutation'
import { useCardStore } from '../../store'
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'
import {
    CardAccountLinkedElsewhereError,
    CardIntegrityAttestationRequiredError,
    CardUserUnavailableError,
} from '../../api/card-creation'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

const ADDRESS = 'FUNDINGADDR'
const BAANX_USER_ID = 'baanx-user-1'
const PROOF = {
    signData: { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' },
    signature: 'c2ln',
    delegationToken: 'ABC_tok',
}

const setValidIntegrityToken = () =>
    useAppIntegrityStore.getState().setRegistration({
        integrityToken: 'TEST_INTEGRITY_TOKEN',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        keyId: 'key',
        deviceId: 'device',
    })

describe('useCreateAndApproveCardMutation', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        useCardStore.getState().resetState()
        useAppIntegrityStore.getState().resetState()
        setValidIntegrityToken()
        buildEnv.appEnvironment = 'production'
        createCard.mockResolvedValue({ cardAddress: 'ESCROW1', txId: 'TX1' })
        postAlgorandDelegationApproval.mockResolvedValue(undefined)
        fetchUser.mockResolvedValue({
            id: BAANX_USER_ID,
            verificationState: 'VERIFIED',
        })
    })

    it('creates then approves using the same proof, and persists the store', async () => {
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        const outcome = await result.current.mutateAsync({
            address: ADDRESS,
            proof: PROOF,
        })

        expect(createCard).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                address: ADDRESS,
                baanxUserId: BAANX_USER_ID,
                currency: 'usdc',
                signData: PROOF.signData,
                signature: PROOF.signature,
            }),
        )
        expect(postAlgorandDelegationApproval).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                address: ADDRESS,
                currency: 'usdc',
                txId: 'TX1',
                signData: PROOF.signData,
                signature: PROOF.signature,
                token: 'ABC_tok',
            }),
        )
        expect(outcome).toEqual({ cardAddress: 'ESCROW1' })
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
        expect(useCardStore.getState().escrowCardTxId).toBe('TX1')
        expect(useCardStore.getState().escrowCardApproved).toBe(true)
    })

    it('linked-elsewhere failure from create: rejects without persisting or approving', async () => {
        createCard.mockRejectedValue(new CardAccountLinkedElsewhereError())
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({ address: ADDRESS, proof: PROOF }),
        ).rejects.toThrow(CardAccountLinkedElsewhereError)
        expect(postAlgorandDelegationApproval).not.toHaveBeenCalled()
        expect(useCardStore.getState().escrowCardAddress).toBeNull()
    })

    it('no Baanx user resolvable: rejects before creating', async () => {
        fetchUser.mockResolvedValue(null)
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({ address: ADDRESS, proof: PROOF }),
        ).rejects.toThrow(CardUserUnavailableError)
        expect(createCard).not.toHaveBeenCalled()
    })

    it('no valid integrity token: rejects before creating anything', async () => {
        useAppIntegrityStore.getState().resetState()
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({ address: ADDRESS, proof: PROOF }),
        ).rejects.toThrow(CardIntegrityAttestationRequiredError)
        expect(createCard).not.toHaveBeenCalled()
    })

    it('no valid integrity token on a development build: proceeds without one', async () => {
        useAppIntegrityStore.getState().resetState()
        buildEnv.appEnvironment = 'development'
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        const outcome = await result.current.mutateAsync({
            address: ADDRESS,
            proof: PROOF,
        })

        expect(createCard).toHaveBeenCalledOnce()
        expect(outcome).toEqual({ cardAddress: 'ESCROW1' })
    })

    it('no valid integrity token on a staging build: proceeds without one', async () => {
        useAppIntegrityStore.getState().resetState()
        buildEnv.appEnvironment = 'staging'
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        const outcome = await result.current.mutateAsync({
            address: ADDRESS,
            proof: PROOF,
        })

        expect(createCard).toHaveBeenCalledOnce()
        expect(outcome).toEqual({ cardAddress: 'ESCROW1' })
    })

    it('create failure: rejects and leaves the store untouched', async () => {
        createCard.mockRejectedValue(new Error('create boom'))
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({ address: ADDRESS, proof: PROOF }),
        ).rejects.toThrow('create boom')
        expect(useCardStore.getState().escrowCardAddress).toBeNull()
        expect(postAlgorandDelegationApproval).not.toHaveBeenCalled()
    })

    it('approval failure after creation: card persists unapproved; a retry with a fresh proof re-approves only', async () => {
        postAlgorandDelegationApproval.mockRejectedValueOnce(
            new Error('approval boom'),
        )
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync({ address: ADDRESS, proof: PROOF }),
        ).rejects.toThrow('approval boom')
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROW1')
        expect(useCardStore.getState().escrowCardApproved).toBe(false)

        const retryOutcome = await result.current.mutateAsync({
            address: ADDRESS,
            proof: {
                ...PROOF,
                signature: 'ZnJlc2g=',
                delegationToken: 'ABC_tok2',
            },
        })

        expect(createCard).toHaveBeenCalledTimes(1)
        expect(postAlgorandDelegationApproval).toHaveBeenCalledTimes(2)
        // The delegation token is single-use, so a retry must carry the fresh
        // proof's token, never the consumed one.
        expect(postAlgorandDelegationApproval.mock.calls[1][0]).toEqual(
            expect.objectContaining({
                signature: 'ZnJlc2g=',
                token: 'ABC_tok2',
            }),
        )
        expect(retryOutcome).toEqual({ cardAddress: 'ESCROW1' })
        expect(useCardStore.getState().escrowCardApproved).toBe(true)
    })

    it('resume: skips both calls when already created and approved for the same account + network', async () => {
        useCardStore.getState().setEscrowCard({
            cardAddress: 'EXISTING_CARD',
            ownerAddress: ADDRESS,
            network: 'testnet',
            txId: 'EXISTING_TX',
        })
        useCardStore.getState().markEscrowCardApproved()
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        const outcome = await result.current.mutateAsync({
            address: ADDRESS,
            proof: PROOF,
        })

        expect(createCard).not.toHaveBeenCalled()
        expect(postAlgorandDelegationApproval).not.toHaveBeenCalled()
        expect(outcome).toEqual({ cardAddress: 'EXISTING_CARD' })
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
        const { result } = renderHook(() => useCreateAndApproveCardMutation(), {
            wrapper,
        })

        const outcome = await result.current.mutateAsync({
            address: ADDRESS,
            proof: PROOF,
        })

        expect(createCard).toHaveBeenCalledWith(
            expect.objectContaining({ address: ADDRESS }),
        )
        expect(outcome).toEqual({ cardAddress: 'CARD_FOR_B' })
    })
})
