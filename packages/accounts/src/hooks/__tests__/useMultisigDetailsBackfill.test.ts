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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMultisigDetailsBackfill } from '../useMultisigDetailsBackfill'

import type { WalletAccount } from '../../models'

const mocks = vi.hoisted(() => ({
    updateAccount: vi.fn(),
    useMultisigAccountDetailQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../useUpdateAccount', () => ({
    useUpdateAccount: () => mocks.updateAccount,
}))

vi.mock('../../utils', () => ({
    isMultisigAccount: (account: WalletAccount) => account.type === 'multisig',
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    useMultisigAccountDetailQuery: mocks.useMultisigAccountDetailQuery,
}))

const detailLessMultisig = {
    type: 'multisig',
    address: 'MSIG_ADDR',
    name: 'Shared Account #4',
} as unknown as WalletAccount

describe('useMultisigDetailsBackfill', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('enables the detail query only when a multisig account lacks details', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isFetching: true,
        })

        renderHook(() => useMultisigDetailsBackfill(detailLessMultisig))

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ address: 'MSIG_ADDR', enabled: true }),
        )
    })

    it('does not fetch when details already exist', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isFetching: false,
        })

        const complete = {
            type: 'multisig',
            address: 'MSIG_ADDR',
            name: 'Shared Account #4',
            multisigDetails: { threshold: 2, addresses: ['A', 'B'] },
        } as unknown as WalletAccount

        renderHook(() => useMultisigDetailsBackfill(complete))

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
        expect(mocks.updateAccount).not.toHaveBeenCalled()
    })

    it('writes fetched threshold + participants back into the account once', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue({
            data: {
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2', 'ADDR3'],
            },
            isFetching: false,
        })

        const { rerender } = renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig),
        )

        expect(mocks.updateAccount).toHaveBeenCalledTimes(1)
        expect(mocks.updateAccount).toHaveBeenCalledWith({
            type: 'multisig',
            address: 'MSIG_ADDR',
            name: 'Shared Account #4',
            multisigDetails: {
                threshold: 2,
                addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
            },
        })

        rerender()
        expect(mocks.updateAccount).toHaveBeenCalledTimes(1)
    })
})
