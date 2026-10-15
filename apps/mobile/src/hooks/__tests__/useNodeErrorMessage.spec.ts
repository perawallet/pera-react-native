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
import { describeNodeError } from '@perawallet/wallet-core-shared'
import { useNodeErrorMessage } from '../useNodeErrorMessage'
import { useLanguage } from '@hooks/useLanguage'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}))

describe('useNodeErrorMessage', () => {
    const mockT = vi.fn((key: string) => key)

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useLanguage as Mock).mockReturnValue({ t: mockT })
    })

    test('translates the keys the chain describes', () => {
        ;(describeNodeError as Mock).mockReturnValueOnce({
            titleKey: 'errors.algod.duplicate_txn.title',
            bodyKey: 'errors.algod.duplicate_txn.body',
            params: { txId: 'ABC' },
        })
        const err = new Error('dup')
        const { result } = renderHook(() => useNodeErrorMessage())

        const message = result.current.getMessage(err)

        expect(describeNodeError).toHaveBeenCalledWith(err)
        expect(message).toEqual({
            title: 'errors.algod.duplicate_txn.title',
            body: 'errors.algod.duplicate_txn.body',
        })
        expect(mockT).toHaveBeenCalledWith('errors.algod.duplicate_txn.body', {
            txId: 'ABC',
        })
    })

    test('converts bigint params to strings for i18n interpolation', () => {
        ;(describeNodeError as Mock).mockReturnValueOnce({
            titleKey: 'errors.algod.below_min_balance.title',
            bodyKey: 'errors.algod.below_min_balance.body',
            params: { address: 'ADDR', balance: 148_000n, assetCount: 1 },
        })
        const { result } = renderHook(() => useNodeErrorMessage())

        result.current.getMessage(new Error('low'))

        expect(mockT).toHaveBeenCalledWith(
            'errors.algod.below_min_balance.body',
            { address: 'ADDR', balance: '148000', assetCount: 1 },
        )
    })

    test('returns undefined when the chain describes nothing', () => {
        ;(describeNodeError as Mock).mockReturnValueOnce(undefined)
        const { result } = renderHook(() => useNodeErrorMessage())

        expect(result.current.getMessage(new Error('odd'))).toBeUndefined()
        expect(mockT).not.toHaveBeenCalled()
    })
})
