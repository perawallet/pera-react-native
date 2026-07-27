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
import { FundingType } from '@perawallet/wallet-core-card'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

// The global setup stubs shared with a partial surface; restore the real
// encoding helpers the injected signers use.
vi.mock('@perawallet/wallet-core-shared', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-shared')),
}))

const mockCreateEscrowCardAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCreateEscrowCardMutation: () => ({
        mutate: vi.fn(),
        mutateAsync: mockCreateEscrowCardAsync,
        isPending: false,
        isError: false,
        isSuccess: false,
        isPaused: false,
        error: null,
        data: null,
        reset: vi.fn(),
    }),
}))

const mockSignArbitraryData = vi.fn()
const mockSignProgram = vi.fn()
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useArbitraryDataSigner: () => ({
        signArbitraryData: mockSignArbitraryData,
    }),
    useProgramSigner: () => ({ signProgram: mockSignProgram }),
    encodeDelegatedLsigAccount: (
        _program: Uint8Array,
        _sig: Uint8Array,
        _addr: string,
    ) => new Uint8Array([9, 9, 9]),
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
    mockSignArbitraryData.mockResolvedValue([new Uint8Array([1, 2, 3])])
    mockSignProgram.mockResolvedValue(new Uint8Array([4, 5, 6]))
    mockCreateEscrowCardAsync.mockResolvedValue({
        cardAddress: 'CARD1',
        fundingType: FundingType.Manual,
        autoFundingDegraded: false,
    })
})

describe('useEscrowCardCreation', () => {
    it('canCreateCard is true only for local-key accounts', () => {
        const { result } = renderHook(() => useEscrowCardCreation())

        expect(result.current.canCreateCard(localKeyAccount)).toBe(true)
        expect(result.current.canCreateCard(ledgerAccount)).toBe(false)
    })

    it('injects a SIWA signer and a LSig signer into the mutation', async () => {
        const { result } = renderHook(() => useEscrowCardCreation())

        await result.current.createCard(localKeyAccount, FundingType.Auto)

        expect(mockCreateEscrowCardAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'FUNDINGADDR',
                fundingType: FundingType.Auto,
                signSiwaMessage: expect.any(Function),
                signLsigProgram: expect.any(Function),
            }),
        )

        // The injected SIWA signer signs the message via arbitrary-data signing.
        const { signSiwaMessage, signLsigProgram } =
            mockCreateEscrowCardAsync.mock.calls[0][0]
        const siwaSig = await signSiwaMessage(new Uint8Array(64))
        expect(mockSignArbitraryData).toHaveBeenCalledWith(
            localKeyAccount,
            expect.any(String),
        )
        expect([...siwaSig]).toEqual([1, 2, 3])

        // The injected LSig signer signs the program and encodes the account.
        const lsigBytes = await signLsigProgram(new Uint8Array([6, 6, 6]))
        expect(mockSignProgram).toHaveBeenCalledWith(
            localKeyAccount,
            expect.any(Uint8Array),
        )
        expect([...lsigBytes]).toEqual([9, 9, 9])
    })

    it('throws before any network call for a non-signing account', () => {
        const { result } = renderHook(() => useEscrowCardCreation())

        expect(() =>
            result.current.createCard(ledgerAccount, FundingType.Manual),
        ).toThrow()
        expect(mockCreateEscrowCardAsync).not.toHaveBeenCalled()
    })
})
