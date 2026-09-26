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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    escrowCardAddress: null as string | null,
}))
const mockAddAssetTransfer = vi.fn()
const mockBuild = vi.fn()
const mockSubmit = vi.fn()
const mockAssignFeeToGroup = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => ({
    ...(await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )),
    useCardStore: (
        selector: (state: { escrowCardAddress: string | null }) => unknown,
    ) => selector({ escrowCardAddress: mocks.escrowCardAddress }),
    useSubmitAndConfirmMutation: () => ({ mutateAsync: mockSubmit }),
}))

vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mockAssignFeeToGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        newGroup: () => ({
            addAssetTransfer: mockAddAssetTransfer,
            build: mockBuild,
        }),
    }),
}))

vi.mock('@tanstack/react-query', async () => ({
    ...(await vi.importActual<object>('@tanstack/react-query')),
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

import {
    useCardManualDeposit,
    CardEscrowUnavailableError,
} from '../useCardManualDeposit'

const account = { address: 'FUNDINGADDR' } as WalletAccount
const ESCROW = 'ESCROWCARDADDR'

describe('useCardManualDeposit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.escrowCardAddress = ESCROW
        mockBuild.mockResolvedValue({ transactions: [{ txn: 'TXN' }] })
        mockAssignFeeToGroup.mockResolvedValue({ transactions: ['FEED_TXN'] })
        mockSubmit.mockResolvedValue({ txIds: ['TX1'] })
    })

    it('transfers USDC in base units from the account to the escrow card', async () => {
        const { result } = renderHook(() => useCardManualDeposit())

        await result.current.deposit({ account, amount: new Decimal('0.4') })

        expect(mockAddAssetTransfer).toHaveBeenCalledWith({
            sender: 'FUNDINGADDR',
            receiver: ESCROW,
            assetId: 10_458_941n,
            amount: 400_000n,
        })
        expect(mockSubmit).toHaveBeenCalledWith({
            unsignedTxs: ['FEED_TXN'],
            source: expect.objectContaining({ name: 'card-add-funds' }),
        })
    })

    // The card balance is read off the escrow account, so a deposit that
    // doesn't invalidate it leaves the screen showing the pre-deposit figure.
    it('invalidates the escrow balance and the sender holdings', async () => {
        const { result } = renderHook(() => useCardManualDeposit())

        await result.current.deposit({ account, amount: new Decimal('1') })

        expect(mockInvalidateQueries).toHaveBeenCalled()
        const keys = mockInvalidateQueries.mock.calls.map(call =>
            JSON.stringify(call[0]),
        )
        expect(keys.some(key => key.includes(ESCROW))).toBe(true)
    })

    it('refuses to deposit when no card has been created', async () => {
        mocks.escrowCardAddress = null
        const { result } = renderHook(() => useCardManualDeposit())

        await expect(
            result.current.deposit({ account, amount: new Decimal('1') }),
        ).rejects.toBeInstanceOf(CardEscrowUnavailableError)
        expect(mockSubmit).not.toHaveBeenCalled()
    })
})
