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

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest'
import { renderHook } from '@testing-library/react'
import { Platform } from 'react-native'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStoreBackupCredentialsSheet } from '../useStoreBackupCredentialsSheet'

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

const mockResolve = vi.fn()
const originalOS = Platform.OS

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
})

afterEach(() => {
    Platform.OS = originalOS
})

describe('useStoreBackupCredentialsSheet', () => {
    test.each([
        ['ios', ['local', 'icloud', 'googleDrive']],
        ['android', ['local', 'googleDrive']],
        ['web', ['local']],
    ] as const)('offers the destinations available on %s', (os, expected) => {
        Platform.OS = os

        const { result } = renderHook(() => useStoreBackupCredentialsSheet())

        expect(result.current.destinations).toEqual(expected)
    })

    test('resolves the sheet with the chosen destination', () => {
        const { result } = renderHook(() => useStoreBackupCredentialsSheet())

        result.current.handleSelect('googleDrive')

        expect(mockResolve).toHaveBeenCalledWith('googleDrive')
    })
})
