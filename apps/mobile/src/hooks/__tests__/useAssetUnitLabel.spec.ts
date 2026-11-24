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
import { imitatedNativeTickerOf } from '@perawallet/wallet-core-currencies'
import { useAssetUnitLabel } from '../useAssetUnitLabel'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const REF = { chainId: 'ethereum' as const, assetId: '0xabc' }

describe('useAssetUnitLabel', () => {
    beforeEach(() => {
        vi.mocked(imitatedNativeTickerOf).mockReset()
    })

    it('Given a unit name that reads as the native ticker, then the generic label stands in for it', () => {
        vi.mocked(imitatedNativeTickerOf).mockReturnValue('ETH')
        const { result } = renderHook(() => useAssetUnitLabel())

        expect(result.current.unitLabelOf(REF, 'ETH')).toBe(
            'asset.imitated_currency.unit_label',
        )
    })

    it('Given any other unit name, then it is shown as it is', () => {
        vi.mocked(imitatedNativeTickerOf).mockReturnValue(null)
        const { result } = renderHook(() => useAssetUnitLabel())

        expect(result.current.unitLabelOf(REF, 'USDC')).toBe('USDC')
    })
})
