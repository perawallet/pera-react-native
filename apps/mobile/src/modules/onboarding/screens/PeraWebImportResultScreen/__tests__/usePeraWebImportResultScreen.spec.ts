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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoute } from '@react-navigation/native'
import { usePeraWebImportResultScreen } from '../usePeraWebImportResultScreen'

const mockHaptics = vi.hoisted(() => ({ success: vi.fn() }))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => mockHaptics,
}))

vi.mock('@hooks/useLanguage')

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    usePeraWebImportFlowStore: (
        selector: (state: { reset: () => void }) => unknown,
    ) => selector({ reset: vi.fn() }),
    useExitAccountFlow: () => ({
        exitAccountFlow: vi.fn(),
        exitFailedAccountFlow: vi.fn(),
    }),
}))

const routeWith = (counts: {
    importedCount?: number
    skippedDuplicateCount?: number
    failedCount?: number
}) =>
    vi.mocked(useRoute).mockReturnValue({
        params: counts,
    } as unknown as ReturnType<typeof useRoute>)

describe('usePeraWebImportResultScreen', () => {
    beforeEach(() => {
        mockHaptics.success.mockClear()
    })

    it('plays the success haptic once when every account imported', () => {
        routeWith({ importedCount: 2, failedCount: 0 })

        const { rerender } = renderHook(() => usePeraWebImportResultScreen())
        rerender()

        expect(mockHaptics.success).toHaveBeenCalledTimes(1)
    })

    it('stays silent on a partial import', () => {
        routeWith({ importedCount: 1, failedCount: 1 })

        renderHook(() => usePeraWebImportResultScreen())

        expect(mockHaptics.success).not.toHaveBeenCalled()
    })

    it('stays silent when nothing new was found', () => {
        routeWith({ importedCount: 0, skippedDuplicateCount: 2 })

        renderHook(() => usePeraWebImportResultScreen())

        expect(mockHaptics.success).not.toHaveBeenCalled()
    })
})
