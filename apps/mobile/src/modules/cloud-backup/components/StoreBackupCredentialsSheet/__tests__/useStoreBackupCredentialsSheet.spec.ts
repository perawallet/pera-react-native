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
import { useCredentialsFileSaveSources } from '../../../hooks/useCredentialsFileSources'
import { useStoreBackupCredentialsSheet } from '../useStoreBackupCredentialsSheet'

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

vi.mock('../../../hooks/useCredentialsFileSources', () => ({
    useCredentialsFileSaveSources: vi.fn(),
}))

const mockResolve = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
    ;(useCredentialsFileSaveSources as Mock).mockReturnValue([
        'device',
        'icloud',
        'googleDrive',
    ])
})

describe('useStoreBackupCredentialsSheet', () => {
    test('offers the destinations the platform and the flag allow', () => {
        ;(useCredentialsFileSaveSources as Mock).mockReturnValue(['device'])

        const { result } = renderHook(() => useStoreBackupCredentialsSheet())

        expect(result.current.destinations.map(row => row.destination)).toEqual(
            ['device'],
        )
    })

    test('gives every row a title and a leading mark', () => {
        const { result } = renderHook(() => useStoreBackupCredentialsSheet())

        for (const row of result.current.destinations) {
            expect(row.title).toBeTruthy()
            expect(row.leftIcon ?? row.leftImage).toBeTruthy()
        }
    })

    test('resolves the sheet with the chosen destination', () => {
        const { result } = renderHook(() => useStoreBackupCredentialsSheet())

        result.current.destinations
            .find(row => row.destination === 'googleDrive')
            ?.onPress?.()

        expect(mockResolve).toHaveBeenCalledWith('googleDrive')
    })

    test('keeps each row stable across a re-render, so the list does not churn', () => {
        const { result, rerender } = renderHook(() =>
            useStoreBackupCredentialsSheet(),
        )
        const first = result.current.destinations

        rerender()

        expect(result.current.destinations).toBe(first)
    })
})
