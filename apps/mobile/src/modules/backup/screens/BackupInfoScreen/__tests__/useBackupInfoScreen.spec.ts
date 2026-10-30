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
    OnboardingEvent: { BeginPassphrase: 'begin_passphrase' },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key} ${JSON.stringify(options)}` : key,
    }),
}))

vi.mock('@modules/view-passphrase', () => ({
    usePassphraseReach: (...args: unknown[]) => mockReach(...args),
}))

import { useBackupInfoScreen } from '../useBackupInfoScreen'

describe('useBackupInfoScreen', () => {
    beforeEach(() => {
        mockReach.mockReset()
    })

    it('names every network the passphrase reaches for a multi-network account', () => {
        mockReach.mockReturnValue({
            isMultiNetwork: true,
            networkNames: ['Algorand', 'Ethereum', 'Base'],
        })

        const { result } = renderHook(() => useBackupInfoScreen())

        expect(mockReach).toHaveBeenCalledWith({ address: 'ADDR' })
        expect(result.current.body).toBe(
            'backup.info.body_all_networks {"networks":"Algorand, Ethereum, Base"}',
        )
    })

    it('keeps the Algorand copy for a single-network account', () => {
        mockReach.mockReturnValue({ isMultiNetwork: false, networkNames: [] })

        const { result } = renderHook(() => useBackupInfoScreen())

        expect(result.current.body).toBe('backup.info.body')
    })
})
