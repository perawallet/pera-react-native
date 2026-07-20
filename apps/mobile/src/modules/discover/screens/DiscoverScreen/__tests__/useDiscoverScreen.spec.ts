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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoute } from '@react-navigation/native'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { isSafeRelativePath } from '@modules/webview/hooks/handlers'
import { useDiscoverScreen } from '../useDiscoverScreen'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { discoverBaseUrl: 'https://discover.example/' },
}))
vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(() => ({ params: {} })),
}))
vi.mock('@perawallet/wallet-core-migrate', () => ({
    useNeedsMigration: vi.fn(() => ({
        isChecking: false,
        needsMigration: false,
        dismiss: vi.fn(),
        setSkipped: vi.fn(),
    })),
}))
vi.mock('@modules/webview/hooks/handlers', () => ({
    isSafeRelativePath: vi.fn(() => true),
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn() },
}))

describe('useDiscoverScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useRoute as Mock).mockReturnValue({ params: {} })
        ;(useNeedsMigration as Mock).mockReturnValue({
            isChecking: false,
            needsMigration: false,
            dismiss: vi.fn(),
            setSkipped: vi.fn(),
        })
        ;(isSafeRelativePath as Mock).mockReturnValue(true)
    })

    it('is not ready while the migration gate is still checking', () => {
        ;(useNeedsMigration as Mock).mockReturnValue({
            isChecking: true,
            needsMigration: false,
            dismiss: vi.fn(),
            setSkipped: vi.fn(),
        })
        const { result } = renderHook(() => useDiscoverScreen())
        expect(result.current.isReady).toBe(false)
    })

    it('is not ready while a migration is needed', () => {
        ;(useNeedsMigration as Mock).mockReturnValue({
            isChecking: false,
            needsMigration: true,
            dismiss: vi.fn(),
            setSkipped: vi.fn(),
        })
        const { result } = renderHook(() => useDiscoverScreen())
        expect(result.current.isReady).toBe(false)
    })

    it('is ready once migration is checked and not needed', () => {
        const { result } = renderHook(() => useDiscoverScreen())
        expect(result.current.isReady).toBe(true)
    })

    it('uses the base url when no path param is provided', () => {
        const { result } = renderHook(() => useDiscoverScreen())
        expect(result.current.url).toBe('https://discover.example/')
    })

    it('appends a safe relative path param to the base url', () => {
        ;(useRoute as Mock).mockReturnValue({ params: { path: 'browse' } })
        const { result } = renderHook(() => useDiscoverScreen())
        expect(result.current.url).toBe('https://discover.example/browse')
    })

    it('falls back to the base url when the path param is unsafe', () => {
        ;(useRoute as Mock).mockReturnValue({ params: { path: '//evil.com' } })
        ;(isSafeRelativePath as Mock).mockReturnValue(false)
        const { result } = renderHook(() => useDiscoverScreen())
        expect(result.current.url).toBe('https://discover.example/')
    })
})
