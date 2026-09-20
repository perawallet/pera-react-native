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
import { LEGACY_BACKUP_CREDENTIALS_FILE_NAME } from '@perawallet/wallet-core-backup'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useChooseCredentialsFileSheet } from '../useChooseCredentialsFileSheet'

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

// Spells the interpolated values out so the address prefix is observable.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key} ${Object.values(options).join(' ')}` : key,
    }),
}))

const mockResolve = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
})

describe('useChooseCredentialsFileSheet', () => {
    test('titles a file with the address prefix its name carries', () => {
        const { result } = renderHook(() =>
            useChooseCredentialsFileSheet(['pera-backup-VQBGR.json']),
        )

        expect(result.current.choices[0]?.title).toBe(
            'cloud_backup.restore.choose_file_row VQBGR',
        )
    })

    test('labels a file saved before names carried an address', () => {
        const { result } = renderHook(() =>
            useChooseCredentialsFileSheet([
                LEGACY_BACKUP_CREDENTIALS_FILE_NAME,
            ]),
        )

        expect(result.current.choices[0]?.title).toBe(
            'cloud_backup.restore.choose_file_unknown',
        )
    })

    test('resolves the sheet with the chosen file name', () => {
        const { result } = renderHook(() =>
            useChooseCredentialsFileSheet([
                'pera-backup-VQBGR.json',
                'pera-backup-ZZZZZ.json',
            ]),
        )

        result.current.choices[1]?.onPress()

        expect(mockResolve).toHaveBeenCalledWith('pera-backup-ZZZZZ.json')
    })
})
