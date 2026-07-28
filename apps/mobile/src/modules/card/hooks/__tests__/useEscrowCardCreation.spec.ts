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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

// The global setup stubs shared with a partial surface; restore the real
// encoding helpers the injected signers use.
vi.mock('@perawallet/wallet-core-shared', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-shared')),
}))

const mockSignOwnershipAsync = vi.fn()
const mockCreateAndApproveAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useSignCardOwnershipMutation: () => ({
        mutate: vi.fn(),
        mutateAsync: mockSignOwnershipAsync,
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
        data: null,
        reset: vi.fn(),
    }),
    useCreateAndApproveCardMutation: () => ({
        mutate: vi.fn(),
        mutateAsync: mockCreateAndApproveAsync,
        isPending: false,
        isError: false,
        isSuccess: false,
        isPaused: false,
        error: null,
        data: null,
        reset: vi.fn(),
    }),
}))

const mockAddSignRequest = vi.fn()
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
}))

import { useEscrowCardCreation } from '../useEscrowCardCreation'

const localKeyAccount: WalletAccount = {
    id: 'a1',
    type: AccountTypes.algo25,
    address: 'FUNDINGADDR',
    keyPairId: 'kp1',
} as WalletAccount

const ledgerAccount: WalletAccount = {
    id: 'a2',
    type: AccountTypes.hardware,
    address: 'LEDGERADDR',
} as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    mockSignOwnershipAsync.mockImplementation(async ({ signArc60 }) => {
        const signature = await signArc60('data', {
            scope: 1,
            encoding: 'base64',
        })
        return {
            signData: { data: 'd', authenticatorData: 'a' },
            signature: [...signature].join(','),
        }
    })
    mockCreateAndApproveAsync.mockResolvedValue({ cardAddress: 'CARD1' })
})

describe('useEscrowCardCreation', () => {
    it('canCreateCard is true only for local-key accounts', () => {
        const { result } = renderHook(() => useEscrowCardCreation())

        expect(result.current.canCreateCard(localKeyAccount)).toBe(true)
        expect(result.current.canCreateCard(ledgerAccount)).toBe(false)
    })

    it('signOwnership enqueues an interactive arc60 request and resolves with the signature', async () => {
        mockAddSignRequest.mockImplementation(request => {
            request.approve([
                { signature: new Uint8Array([1, 2, 3]), signer: 'FUNDINGADDR' },
            ])
        })
        const { result } = renderHook(() => useEscrowCardCreation())

        const proof = await result.current.signOwnership(localKeyAccount)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'arc60',
                transport: 'callback',
                sourceType: 'arc60',
                stdSigData: 'data',
                metadata: { scope: 1, encoding: 'base64' },
            }),
        )
        expect(proof.signature).toBe('1,2,3')
    })

    it('signOwnership rejects when the user declines the approval screen', async () => {
        mockAddSignRequest.mockImplementation(request => {
            request.reject()
        })
        const { result } = renderHook(() => useEscrowCardCreation())

        await expect(
            result.current.signOwnership(localKeyAccount),
        ).rejects.toThrow()
    })

    it('signOwnership rejects on a signing error from the approval screen', async () => {
        mockAddSignRequest.mockImplementation(request => {
            request.error(new Error('boom'))
        })
        const { result } = renderHook(() => useEscrowCardCreation())

        await expect(
            result.current.signOwnership(localKeyAccount),
        ).rejects.toThrow('boom')
    })

    it('throws before enqueuing any request for a non-signing account', async () => {
        const { result } = renderHook(() => useEscrowCardCreation())

        expect(() => result.current.signOwnership(ledgerAccount)).toThrow()
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('createAndApprove forwards the address and proof', async () => {
        const { result } = renderHook(() => useEscrowCardCreation())
        const proof = {
            signData: { data: 'd', authenticatorData: 'a' },
            signature: 's',
        }

        await result.current.createAndApprove(localKeyAccount, proof)

        expect(mockCreateAndApproveAsync).toHaveBeenCalledWith({
            address: 'FUNDINGADDR',
            proof,
        })
    })
})
