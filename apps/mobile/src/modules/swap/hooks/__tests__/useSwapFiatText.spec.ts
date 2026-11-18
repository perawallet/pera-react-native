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
import { useSwapFiatText } from '../useSwapFiatText'

const { mockLocalCurrency } = vi.hoisted(() => ({
    mockLocalCurrency: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useLocalCurrency: mockLocalCurrency,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-shared')>(),
)

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ currentLanguage: 'en' }),
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const render = () => renderHook(() => useSwapFiatText(SCOPE)).result.current

describe('useSwapFiatText', () => {
    beforeEach(() => {
        mockLocalCurrency.mockReturnValue({
            localCurrency: 'EUR',
            localRate: new Decimal(2),
        })
    })

    it('converts USD at the local rate and rounds as asked', () => {
        const toFiatText = render()

        expect(toFiatText(new Decimal('1.234'), Decimal.ROUND_UP)).toBe(
            '€ 2.47',
        )
        expect(toFiatText(new Decimal('1.234'), Decimal.ROUND_DOWN)).toBe(
            '€ 2.46',
        )
    })

    it('is null until the rate is known', () => {
        mockLocalCurrency.mockReturnValue({
            localCurrency: 'EUR',
            localRate: null,
        })

        expect(render()(new Decimal(1), Decimal.ROUND_UP)).toBeNull()
    })
})
