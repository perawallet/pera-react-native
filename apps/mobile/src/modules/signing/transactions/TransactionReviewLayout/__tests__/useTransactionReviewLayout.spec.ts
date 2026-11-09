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
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import type { ReviewWarningItem } from '../../../components/ReviewWarningsBanner'
import { useTransactionReviewLayout } from '../useTransactionReviewLayout'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

const CHAIN_ITEM: ReviewWarningItem = {
    id: 'chain_warning',
    message: 'careful',
    isHighRisk: true,
}

describe('useTransactionReviewLayout', () => {
    beforeEach(() => {
        ;(useSigningRequest as Mock).mockReturnValue({
            currentRequest: { id: 'request-1' },
        })
    })

    it("passes the chain's warnings through unchanged", () => {
        const { result } = renderHook(() =>
            useTransactionReviewLayout([CHAIN_ITEM]),
        )

        expect(result.current.warningItems).toEqual([CHAIN_ITEM])
    })

    it('has no items when nothing warns', () => {
        const { result } = renderHook(() => useTransactionReviewLayout())

        expect(result.current.warningItems).toEqual([])
    })

    it("puts the replacement notice, which is advisory, ahead of the chain's warnings", () => {
        ;(useSigningRequest as Mock).mockReturnValue({
            currentRequest: { id: 'request-1', replacesTxId: 'TXID123' },
        })

        const { result } = renderHook(() =>
            useTransactionReviewLayout([CHAIN_ITEM]),
        )

        expect(result.current.warningItems).toHaveLength(2)
        expect(result.current.warningItems[0]).toMatchObject({
            id: 'signing_replaces_notice',
            isHighRisk: false,
        })
        expect(result.current.warningItems[1]).toBe(CHAIN_ITEM)
    })
})
