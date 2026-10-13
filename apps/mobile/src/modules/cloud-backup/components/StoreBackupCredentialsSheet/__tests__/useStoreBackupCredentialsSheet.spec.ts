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

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStoreBackupCredentialsSheet } from '../useStoreBackupCredentialsSheet'

const { mockDestinations } = vi.hoisted(() => ({ mockDestinations: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

vi.mock('../../../hooks/useCredentialsFileDestinations', () => ({
    useCredentialsFileDestinations: mockDestinations,
}))

const mockResolve = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
    mockDestinations.mockReturnValue([{ key: 'device' }])
})

describe('useStoreBackupCredentialsSheet', () => {
    test('resolves the sheet with the chosen destination', () => {
        renderHook(() => useStoreBackupCredentialsSheet())

        expect(mockDestinations).toHaveBeenCalledWith(mockResolve)
    })

    test('offers the destinations the shared hook builds', () => {
        const { result } = renderHook(() => useStoreBackupCredentialsSheet())

        expect(result.current.destinations).toEqual([{ key: 'device' }])
    })
})
