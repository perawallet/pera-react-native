/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { render, fireEvent, screen } from '@test-utils/render'
import { AppVersion } from '../AppVersion'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useToast } from '@hooks/useToast'
import { UserPreferences } from '@constants/user-preferences'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) => {
            if (params?.version && params?.build)
                return `Version ${params.version} (${params.build})`
            if (params?.remaining !== undefined)
                return `${params.remaining} taps remaining`
            return key
        },
    }),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useDeviceInfoService: () => ({
        getAppVersion: () => '1.0.0',
        getAppBuild: () => '1',
    }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

describe('AppVersion', () => {
    const mockSetPreference = vi.fn()
    const mockShowToast = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(usePreferences as Mock).mockReturnValue({
            setPreference: mockSetPreference,
        })
        ;(useToast as Mock).mockReturnValue({
            showToast: mockShowToast,
        })
    })

    it('renders version text', () => {
        render(<AppVersion />)

        expect(screen.getByText('Version 1.0.0 (1)')).toBeTruthy()
    })

    it('does not respond to taps when enableSecretTaps is false', () => {
        render(<AppVersion enableSecretTaps={false} />)

        const versionText = screen.getByText('Version 1.0.0 (1)')

        // Try tapping multiple times
        for (let i = 0; i < 15; i++) {
            fireEvent.click(versionText)
        }

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockSetPreference).not.toHaveBeenCalled()
    })

    it('shows countdown toast after 7 rapid taps', () => {
        vi.useFakeTimers()
        render(<AppVersion enableSecretTaps={true} />)

        const versionText = screen.getByText('Version 1.0.0 (1)')

        // Tap 7 times rapidly
        for (let i = 0; i < 7; i++) {
            fireEvent.click(versionText)
            vi.advanceTimersByTime(100) // Less than TAP_TIMEOUT (1000ms)
        }

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                body: '3 taps remaining',
                type: 'info',
            }),
            expect.any(Object),
        )

        vi.useRealTimers()
    })

    it('enables developer menu after 10 rapid taps', () => {
        vi.useFakeTimers()
        render(<AppVersion enableSecretTaps={true} />)

        const versionText = screen.getByText('Version 1.0.0 (1)')

        // Tap 10 times rapidly
        for (let i = 0; i < 10; i++) {
            fireEvent.click(versionText)
            vi.advanceTimersByTime(100)
        }

        expect(mockSetPreference).toHaveBeenCalledWith(
            UserPreferences.developerMenuEnabled,
            true,
        )
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                body: 'settings.developer.developer_menu_enabled',
                type: 'success',
            }),
            expect.objectContaining({
                queueMode: 'reset',
            }),
        )

        vi.useRealTimers()
    })

    it('resets tap count if taps are too slow', () => {
        vi.useFakeTimers()
        render(<AppVersion enableSecretTaps={true} />)

        const versionText = screen.getByText('Version 1.0.0 (1)')

        // Tap 5 times rapidly
        for (let i = 0; i < 5; i++) {
            fireEvent.click(versionText)
            vi.advanceTimersByTime(100)
        }

        // Wait longer than TAP_TIMEOUT
        vi.advanceTimersByTime(1500)

        // Tap 5 more times
        for (let i = 0; i < 5; i++) {
            fireEvent.click(versionText)
            vi.advanceTimersByTime(100)
        }

        // Should not have enabled developer mode (count reset)
        expect(mockSetPreference).not.toHaveBeenCalled()

        vi.useRealTimers()
    })
})
