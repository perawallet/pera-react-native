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
import { renderHook, act } from '@testing-library/react'
import { useRoute } from '@react-navigation/native'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { isSafeRelativePath } from '@modules/webview/hooks/handlers'
import { useDiscoverDetailScreen } from '../useDiscoverDetailScreen'

const goBack = vi.fn()

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { discoverBaseUrl: 'https://discover.example/' },
}))
vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(() => ({ params: {} })),
    useNavigation: vi.fn(() => ({ goBack })),
}))
vi.mock('@perawallet/wallet-core-migrate', () => ({
    useNeedsMigration: vi.fn(() => ({
        isChecking: false,
        needsMigration: false,
    })),
}))
vi.mock('@modules/webview/hooks/handlers', () => ({
    isSafeRelativePath: vi.fn(() => true),
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn() },
}))

describe('useDiscoverDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useRoute as Mock).mockReturnValue({
            params: { path: 'token-detail/ALGO' },
        })
        ;(useNeedsMigration as Mock).mockReturnValue({
            isChecking: false,
            needsMigration: false,
        })
        ;(isSafeRelativePath as Mock).mockReturnValue(true)
    })

    it('appends the path param to the discover base url', () => {
        const { result } = renderHook(() => useDiscoverDetailScreen())
        expect(result.current.url).toBe(
            'https://discover.example/token-detail/ALGO',
        )
    })

    it('falls back to the base url when the path param is unsafe', () => {
        ;(useRoute as Mock).mockReturnValue({ params: { path: '//evil.com' } })
        ;(isSafeRelativePath as Mock).mockReturnValue(false)
        const { result } = renderHook(() => useDiscoverDetailScreen())
        expect(result.current.url).toBe('https://discover.example/')
    })

    it('is not ready while the migration gate is unsettled', () => {
        ;(useNeedsMigration as Mock).mockReturnValue({
            isChecking: true,
            needsMigration: false,
        })
        const { result } = renderHook(() => useDiscoverDetailScreen())
        expect(result.current.isReady).toBe(false)
    })

    it('pops the screen when the page requests back or close', () => {
        const { result } = renderHook(() => useDiscoverDetailScreen())
        act(() => result.current.handleBack())
        expect(goBack).toHaveBeenCalledTimes(1)
    })
})
