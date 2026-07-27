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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTestnetIndicator } from '../useTestnetIndicator'

const mockNetworkState = vi.hoisted(() => ({ isTestnet: false }))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ isTestnet: mockNetworkState.isTestnet }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

describe('useTestnetIndicator', () => {
    it('is hidden on MainNet', () => {
        mockNetworkState.isTestnet = false

        const { result } = renderHook(() => useTestnetIndicator())

        expect(result.current.isVisible).toBe(false)
    })

    it('is visible with the TestNet label on TestNet', () => {
        mockNetworkState.isTestnet = true

        const { result } = renderHook(() => useTestnetIndicator())

        expect(result.current.isVisible).toBe(true)
        expect(result.current.label).toBe('common.testnet_indicator')
    })
})
