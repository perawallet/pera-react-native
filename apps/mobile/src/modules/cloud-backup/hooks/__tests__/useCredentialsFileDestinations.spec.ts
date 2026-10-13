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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCredentialsFileDestinations } from '../useCredentialsFileDestinations'

const { mockSaveSources, mockTranslate } = vi.hoisted(() => ({
    mockSaveSources: vi.fn(),
    mockTranslate: (key: string) => key,
}))

vi.mock('../useCredentialsFileSources', () => ({
    useCredentialsFileSaveSources: mockSaveSources,
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockTranslate }),
}))

beforeEach(() => {
    vi.clearAllMocks()
    mockSaveSources.mockReturnValue(['device', 'icloud', 'googleDrive'])
})

describe('useCredentialsFileDestinations', () => {
    test('builds a row per visible source', () => {
        const { result } = renderHook(() =>
            useCredentialsFileDestinations(vi.fn()),
        )

        expect(result.current).toMatchObject([
            {
                key: 'device',
                title: 'cloud_backup.store_credentials.store_locally',
                testID: 'store_backup_credentials_local',
                leftIcon: 'device',
            },
            {
                key: 'icloud',
                title: 'cloud_backup.store_credentials.icloud',
                testID: 'store_backup_credentials_icloud',
                leftImage: expect.anything(),
            },
            {
                key: 'googleDrive',
                title: 'cloud_backup.store_credentials.google_drive',
                testID: 'store_backup_credentials_google_drive',
                leftIcon: 'google-drive',
            },
        ])
    })

    test('hands the chosen source back to the caller', () => {
        const onSelect = vi.fn()
        const { result } = renderHook(() =>
            useCredentialsFileDestinations(onSelect),
        )

        result.current[1].onPress()

        expect(onSelect).toHaveBeenCalledWith('icloud')
    })

    test('renders only the sources the flag leaves visible', () => {
        mockSaveSources.mockReturnValue(['device'])

        const { result } = renderHook(() =>
            useCredentialsFileDestinations(vi.fn()),
        )

        expect(result.current).toHaveLength(1)
    })

    test('keeps the rows stable across a re-render, so the list does not churn', () => {
        const onSelect = vi.fn()
        const { result, rerender } = renderHook(() =>
            useCredentialsFileDestinations(onSelect),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })
})
