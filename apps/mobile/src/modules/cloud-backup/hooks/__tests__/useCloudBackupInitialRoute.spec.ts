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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useCloudBackupInitialRoute } from '../useCloudBackupInitialRoute'

const { mockCloudBackupState } = vi.hoisted(() => ({
    mockCloudBackupState: { isConfigured: (): boolean => false },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: (selector: (state: unknown) => unknown) =>
        selector(mockCloudBackupState),
}))

const mockPreferences = (seen: boolean) => {
    vi.mocked(usePreferences).mockReturnValue({
        getPreference: vi.fn((key: string) =>
            key === UserPreferences.cloudBackupIntroSeen ? seen : null,
        ),
        setPreference: vi.fn(),
    } as unknown as ReturnType<typeof usePreferences>)
}

describe('useCloudBackupInitialRoute', () => {
    beforeEach(() => {
        mockCloudBackupState.isConfigured = () => false
        mockPreferences(false)
    })

    it('opens the intro when backup is unconfigured and the intro is unseen', () => {
        const { result } = renderHook(() => useCloudBackupInitialRoute())

        expect(result.current).toBe('CloudBackupIntro')
    })

    it('opens the options screen once the intro has been seen', () => {
        mockPreferences(true)

        const { result } = renderHook(() => useCloudBackupInitialRoute())

        expect(result.current).toBe('CloudBackupHome')
    })

    it.each([true, false])(
        'opens the overview when backup is configured, intro seen: %s',
        isIntroSeen => {
            mockCloudBackupState.isConfigured = () => true
            mockPreferences(isIntroSeen)

            const { result } = renderHook(() => useCloudBackupInitialRoute())

            expect(result.current).toBe('CloudBackupOverview')
        },
    )
})
