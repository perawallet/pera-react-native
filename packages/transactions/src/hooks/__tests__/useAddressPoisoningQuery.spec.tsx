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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    assessAddressPoisoning,
    type AddressPoisoningInput,
} from '../../address-poisoning'
import { useAddressPoisoningQuery } from '../useAddressPoisoningQuery'

vi.mock('../../address-poisoning', () => ({
    assessAddressPoisoning: vi.fn(),
}))

const INPUT: AddressPoisoningInput = {
    recipient: 'RECEIVER',
    scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' },
    ownAddresses: ['OWN'],
    senders: ['OWN'],
    contactAddresses: ['CONTACT'],
}

describe('useAddressPoisoningQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient()
    })

    const render = () =>
        renderHook(() => useAddressPoisoningQuery(), {
            wrapper: ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            ),
        })

    it('resolves the risk the screen finds', async () => {
        vi.mocked(assessAddressPoisoning).mockResolvedValue({
            kind: 'dustOnly',
        })
        const { result } = render()

        const risk = await result.current.assessRecipient(INPUT)

        expect(risk).toEqual({ kind: 'dustOnly' })
        expect(assessAddressPoisoning).toHaveBeenCalledWith(INPUT)
    })

    it('screens again on every call instead of reusing a result', async () => {
        vi.mocked(assessAddressPoisoning)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ kind: 'lookalike', similarTo: 'KNOWN' })
        const { result } = render()

        await result.current.assessRecipient(INPUT)
        const second = await result.current.assessRecipient(INPUT)

        expect(second).toEqual({ kind: 'lookalike', similarTo: 'KNOWN' })
        expect(assessAddressPoisoning).toHaveBeenCalledTimes(2)
    })
})
