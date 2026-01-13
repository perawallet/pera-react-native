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

import { renderHook } from '@testing-library/react'
import { useIsDarkMode } from '../theme'
import { useColorScheme } from 'react-native'
import { useSettings } from '@perawallet/wallet-core-settings'

vi.mock('react-native', () => ({
    useColorScheme: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(),
}))

describe('useIsDarkMode', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return true if theme is dark', () => {
        ;(useSettings as vi.Mock).mockReturnValue({ theme: 'dark' })
        ;(useColorScheme as vi.Mock).mockReturnValue('light')

        const { result } = renderHook(() => useIsDarkMode())
        expect(result.current).toBe(true)
    })

    it('should return false if theme is light', () => {
        ;(useSettings as vi.Mock).mockReturnValue({ theme: 'light' })
        ;(useColorScheme as vi.Mock).mockReturnValue('dark')

        const { result } = renderHook(() => useIsDarkMode())
        expect(result.current).toBe(false)
    })

    it('should return true if theme is system and scheme is dark', () => {
        ;(useSettings as vi.Mock).mockReturnValue({ theme: 'system' })
        ;(useColorScheme as vi.Mock).mockReturnValue('dark')

        const { result } = renderHook(() => useIsDarkMode())
        expect(result.current).toBe(true)
    })

    it('should return false if theme is system and scheme is light', () => {
        ;(useSettings as vi.Mock).mockReturnValue({ theme: 'system' })
        ;(useColorScheme as vi.Mock).mockReturnValue('light')

        const { result } = renderHook(() => useIsDarkMode())
        expect(result.current).toBe(false)
    })
})
