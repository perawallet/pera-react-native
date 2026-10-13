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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useMenuScreen } from '../useMenuScreen'

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    MenuEvent: { QrScan: 'QrScan' },
}))

describe('useMenuScreen', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('offers staking only while the staking capability is on', () => {
        const { result } = renderHook(() => useMenuScreen())
        expect(result.current.canStake).toBe(true)

        act(() => setCapabilityOverrides({ staking: false }))

        expect(result.current.canStake).toBe(false)
    })

    it('starts with the scanner closed', () => {
        const { result } = renderHook(() => useMenuScreen())

        expect(result.current.isScannerVisible).toBe(false)
    })

    it('opens the scanner via openScanner', () => {
        const { result } = renderHook(() => useMenuScreen())

        act(() => {
            result.current.openScanner()
        })

        expect(result.current.isScannerVisible).toBe(true)
    })

    it('closes the scanner via closeScanner', () => {
        const { result } = renderHook(() => useMenuScreen())

        act(() => {
            result.current.openScanner()
        })
        expect(result.current.isScannerVisible).toBe(true)

        act(() => {
            result.current.closeScanner()
        })

        expect(result.current.isScannerVisible).toBe(false)
    })
})
