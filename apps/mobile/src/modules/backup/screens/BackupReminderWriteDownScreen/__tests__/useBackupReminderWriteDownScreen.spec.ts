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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReach = vi.hoisted(() => vi.fn())

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: vi.fn() }),
    useRoute: () => ({ params: { address: 'ADDR' } }),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    OnboardingEvent: { UnderstandPassphrase: 'understand_passphrase' },
}))

vi.mock('@hooks/useLanguage')

vi.mock('../../../hooks', () => ({
    usePassphraseReach: (...args: unknown[]) => mockReach(...args),
}))

import { useBackupReminderWriteDownScreen } from '../useBackupReminderWriteDownScreen'

describe('useBackupReminderWriteDownScreen', () => {
    beforeEach(() => {
        mockReach.mockReset()
    })

    it('uses the all-networks copy for a multi-network account', () => {
        mockReach.mockReturnValue({ isMultiNetwork: true })

        const { result } = renderHook(() => useBackupReminderWriteDownScreen())

        expect(mockReach).toHaveBeenCalledWith({ address: 'ADDR' })
        expect(result.current.body).toBe('backup.write_down.body_all_networks')
        expect(result.current.warning).toBe(
            'backup.write_down.warning_all_networks',
        )
    })

    it('keeps the Algorand copy for a single-network account', () => {
        mockReach.mockReturnValue({ isMultiNetwork: false })

        const { result } = renderHook(() => useBackupReminderWriteDownScreen())

        expect(result.current.body).toBe('backup.write_down.body')
        expect(result.current.warning).toBe('backup.write_down.warning')
    })
})
