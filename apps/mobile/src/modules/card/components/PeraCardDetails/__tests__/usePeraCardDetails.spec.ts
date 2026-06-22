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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = vi.hoisted(() => ({ panLast4: null as string | null }))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (
            selector: (state: { lastKnownPanLast4: string | null }) => unknown,
        ) => selector({ lastKnownPanLast4: mockState.panLast4 }),
    }
})

import { usePeraCardDetails } from '../usePeraCardDetails'

describe('usePeraCardDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.panLast4 = null
    })

    it('masks the PAN with the last 4 when known', () => {
        mockState.panLast4 = '2234'

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.maskedPan).toBe('•••• 2234')
    })

    it('falls back to a fully-masked PAN when the last 4 is unknown', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.maskedPan).toBe('•••• ••••')
    })
})
