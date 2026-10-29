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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useAssetHoldings } from '../useAssetHoldings'

const { mockCopyToClipboard } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(),
}))

const ETH = { unitName: 'ETH' }

describe('useAssetHoldings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
        } as ReturnType<typeof useSettings>)
    })

    it('copies the full-precision amount and names it in the toast', () => {
        const { result } = renderHook(() =>
            useAssetHoldings(new Decimal('0.001344293173000001'), ETH),
        )

        result.current.handleCopyAmount()

        expect(result.current.canCopyAmount).toBe(true)
        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            '0.001344293173000001',
            { body: '0.001344293173000001 ETH' },
        )
    })

    it('copies nothing in privacy mode', () => {
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: true,
        } as ReturnType<typeof useSettings>)
        const { result } = renderHook(() =>
            useAssetHoldings(new Decimal('1.5'), ETH),
        )

        result.current.handleCopyAmount()

        expect(result.current.canCopyAmount).toBe(false)
        expect(mockCopyToClipboard).not.toHaveBeenCalled()
    })
})
