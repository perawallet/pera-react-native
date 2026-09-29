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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AlgodError } from '@perawallet/wallet-core-blockchain'
import { useAlgodErrorMessage } from '../useAlgodErrorMessage'
import { useLanguage } from '@hooks/useLanguage'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}))

// Use the real blockchain package — the hook relies on actual AlgodError
// instanceof checks and toAlgodError parsing, which the global mock in
// vitest.setup.ts stubs out.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-blockchain')
    >('@perawallet/wallet-core-blockchain')
    return actual
})

const ADDR = 'GBFKIKHL55YJRTB4PSWXWQJDPHG6IHOLESWSWPPPR6HQ2N7H76RBI5JIT4'

describe('useAlgodErrorMessage', () => {
    const mockT = vi.fn((key: string) => key)

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useLanguage as Mock).mockReturnValue({ t: mockT })
    })

    test('looks up the per-code i18n keys for an AlgodError', () => {
        const err = new AlgodError('duplicate_txn', { txId: 'ABC' })
        const { result } = renderHook(() => useAlgodErrorMessage())

        const message = result.current.getMessage(err)

        expect(message.title).toBe('errors.algod.duplicate_txn.title')
        expect(message.body).toBe('errors.algod.duplicate_txn.body')
        expect(mockT).toHaveBeenCalledWith('errors.algod.duplicate_txn.body', {
            txId: 'ABC',
        })
    })

    // overspend can no longer carry balance/spent/missing —
    // parseAlgodMessage.ts leaves them unset because the message's rendered
    // balance is fee-adjusted, not the account's actual balance (see
    // algodErrorCodes.ts). below_min_balance's params aren't affected by that
    // and still exercise the same bigint-to-string interpolation path.
    test('converts bigint params to strings for i18n interpolation', () => {
        const err = new AlgodError('below_min_balance', {
            address: ADDR,
            balance: 148_000n,
            required: 200_000n,
            assetCount: 1,
        })
        const { result } = renderHook(() => useAlgodErrorMessage())

        result.current.getMessage(err)

        expect(mockT).toHaveBeenCalledWith(
            'errors.algod.below_min_balance.body',
            {
                address: ADDR,
                balance: '148000',
                required: '200000',
                assetCount: 1,
            },
        )
    })

    test('translates raw Errors via toAlgodError before rendering', () => {
        const raw = new Error(
            `overspend (account ${ADDR}, data {AccountBaseData:{MicroAlgos:{Raw:100}}}, tried to spend {200})`,
        )
        const { result } = renderHook(() => useAlgodErrorMessage())

        result.current.getMessage(raw)

        expect(mockT).toHaveBeenCalledWith('errors.algod.overspend.title')
    })

    test('remaps network_unavailable to the shared offline copy', () => {
        const err = new AlgodError('network_unavailable', {})
        const { result } = renderHook(() => useAlgodErrorMessage())

        const message = result.current.getMessage(err)

        expect(message.title).toBe('errors.network.no_connection.title')
        expect(message.body).toBe('errors.network.no_connection.body')
        expect(mockT).not.toHaveBeenCalledWith(
            'errors.algod.network_unavailable.title',
        )
    })
})
