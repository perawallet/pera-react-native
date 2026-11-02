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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { useTransactionHeroTitle } from '../useTransactionHeroTitle'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key}(${Object.values(params).join(',')})` : key,
    }),
}))

describe('useTransactionHeroTitle', () => {
    const heroTitle = () =>
        renderHook(() => useTransactionHeroTitle()).result.current

    it("names a row's label as that kind of transaction", () => {
        expect(
            heroTitle()({ key: i18nKey('transactions.list_item.opt_out') }),
        ).toBe(
            'transactions.common.typed_title(transactions.list_item.opt_out)',
        )
    })

    it('leaves the generic and interpreted titles bare', () => {
        const title = heroTitle()

        expect(title({ key: i18nKey('transactions.list_item.default') })).toBe(
            'transactions.list_item.default',
        )
        expect(
            title({
                key: i18nKey('transactions.list_item.interpreted_title'),
                params: { title: 'Tinyman swap' },
            }),
        ).toBe('transactions.list_item.interpreted_title(Tinyman swap)')
    })
})
