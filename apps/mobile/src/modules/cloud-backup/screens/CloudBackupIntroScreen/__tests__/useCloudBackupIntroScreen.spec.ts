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
import { trackEvent, CloudBackupEvent } from '@analytics'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useCloudBackupIntroScreen } from '../useCloudBackupIntroScreen'

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ replace: mockReplace }),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

const mockSetPreference = vi.fn()

describe('useCloudBackupIntroScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(usePreferences).mockReturnValue({
            getPreference: vi.fn(),
            setPreference: mockSetPreference,
        } as unknown as ReturnType<typeof usePreferences>)
    })

    it('tracks the continue tap, retires the intro and opens the options screen', () => {
        const { result } = renderHook(() => useCloudBackupIntroScreen())

        result.current.handleContinue()

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.IntroContinue)
        expect(mockSetPreference).toHaveBeenCalledWith(
            UserPreferences.cloudBackupIntroSeen,
            true,
        )
        expect(mockReplace).toHaveBeenCalledWith('CloudBackupHome')
    })
})
