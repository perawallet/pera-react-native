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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecipientPoisoningGate } from '../useRecipientPoisoningGate'

const mocks = vi.hoisted(() => ({
    assessRecipient: vi.fn(),
    request: vi.fn(),
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const RECIPIENT = 'RECIPIENT'

vi.mock('@modules/transactions/hooks', () => ({
    useSendScope: () => SCOPE,
}))

const SIGNABLE = { chains: { algorand: { address: 'OWN' } } }

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [
        SIGNABLE,
        { chains: { algorand: { address: 'WATCHED' } } },
        { chains: { ethereum: { address: '0xOWN' } } },
    ],
    useSigningAccounts: () => [SIGNABLE],
    addressOn: (
        account: { chains: Record<string, { address: string }> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({
        contacts: [
            { id: '1', name: 'A', addresses: { algorand: 'CONTACT' } },
            { id: '2', name: 'B', addresses: { evm: '0xCONTACT' } },
        ],
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: () => ({ family: 'algorand' }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAddressPoisoningQuery: () => ({
        assessRecipient: mocks.assessRecipient,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

vi.mock(
    '../../../components/send-funds/AddressPoisoningWarningContent',
    () => ({ AddressPoisoningWarningContent: () => null }),
)

describe('useRecipientPoisoningGate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.assessRecipient.mockResolvedValue(null)
    })

    const screen = async (address = RECIPIENT) => {
        const { result } = renderHook(() => useRecipientPoisoningGate())
        let isApproved = false
        await act(async () => {
            isApproved = await result.current.screenRecipient(address)
        })
        return isApproved
    }

    it('lets a recipient with no risk through without a sheet', async () => {
        await expect(screen()).resolves.toBe(true)
        expect(mocks.request).not.toHaveBeenCalled()
    })

    it("screens against the chain's own addresses and contacts only, with only signing accounts as senders", async () => {
        await screen()

        expect(mocks.assessRecipient).toHaveBeenCalledWith({
            recipient: RECIPIENT,
            scope: SCOPE,
            ownAddresses: ['OWN', 'WATCHED'],
            senders: ['OWN'],
            contactAddresses: ['CONTACT'],
        })
    })

    it('continues when the user confirms the warning', async () => {
        mocks.assessRecipient.mockResolvedValue({ kind: 'dustOnly' })
        mocks.request.mockResolvedValue('continue')

        await expect(screen()).resolves.toBe(true)
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })

    it('stops when the user dismisses the warning', async () => {
        mocks.assessRecipient.mockResolvedValue({
            kind: 'lookalike',
            similarTo: 'CONTACT',
        })
        mocks.request.mockResolvedValue(undefined)

        await expect(screen()).resolves.toBe(false)
    })

    it('lets the send through when screening itself fails', async () => {
        mocks.assessRecipient.mockRejectedValue(new Error('no codec'))

        await expect(screen()).resolves.toBe(true)
        expect(mocks.request).not.toHaveBeenCalled()
    })
})
