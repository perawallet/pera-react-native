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
const { mockBuildDeposit, mockSettlementAsset } = vi.hoisted(() => ({
    mockBuildDeposit: vi.fn(),
    mockSettlementAsset: vi.fn(),
}))
const mockSubmit = vi.fn()
const mockAssignFeeToGroup = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardStore: (
        selector: (state: { escrowCardAddress: string | null }) => unknown,
    ) => selector({ escrowCardAddress: mocks.escrowCardAddress }),
    useSubmitAndConfirmMutation: () => ({ mutateAsync: mockSubmit }),
    buildCardManualDeposit: mockBuildDeposit,
    getCardSettlementAssetId: mockSettlementAsset,
}))

vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mockAssignFeeToGroup,
    }),
}))

const SCOPE = { chainId: 'algorand', networkId: 'testnet' }
vi.mock('../useCardScope', () => ({ useCardScope: () => SCOPE }))

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
        mockSettlementAsset.mockReturnValue('10458941')
        mockBuildDeposit.mockResolvedValue(['TXN'])
        mockAssignFeeToGroup.mockResolvedValue({ transactions: ['FEED_TXN'] })
        mockSubmit.mockResolvedValue({ txIds: ['TX1'] })
    })

    it('transfers USDC in base units from the account to the escrow card', async () => {
        const { result } = renderHook(() => useCardManualDeposit())

        await result.current.deposit({ account, amount: new Decimal('0.4') })

        expect(mockSettlementAsset).toHaveBeenCalledWith(SCOPE)
        expect(mockBuildDeposit).toHaveBeenCalledWith(
            { sender: 'FUNDINGADDR', cardAddress: ESCROW, amount: 400_000n },
            SCOPE,
        )
        expect(mockAssignFeeToGroup).toHaveBeenCalledWith({
            transactions: ['TXN'],
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

    it('refuses to deposit on a network with no settlement asset', async () => {
        mockSettlementAsset.mockReturnValue(null)
        const { result } = renderHook(() => useCardManualDeposit())

        await expect(
            result.current.deposit({ account, amount: new Decimal('1') }),
        ).rejects.toBeInstanceOf(CardEscrowUnavailableError)
        expect(mockBuildDeposit).not.toHaveBeenCalled()
    })
})
