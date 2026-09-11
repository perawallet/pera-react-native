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
import { UserPreferences } from '@constants/user-preferences'
import { useCloudBackupIntroPrompt } from '../useCloudBackupIntroPrompt'

const mocks = vi.hoisted(() => ({
    isCloudBackupEnabled: true,
    isCloudBackupConfigured: false,
    preferences: {} as Record<string, unknown>,
    setPreference: vi.fn(),
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => mocks.isCloudBackupEnabled,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: (
        selector: (state: { isConfigured: () => boolean }) => unknown,
    ) => selector({ isConfigured: () => mocks.isCloudBackupConfigured }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        getPreference: (key: string) => mocks.preferences[key] ?? null,
        setPreference: mocks.setPreference,
    }),
}))

describe('useCloudBackupIntroPrompt', () => {
    beforeEach(() => {
        mocks.isCloudBackupEnabled = true
        mocks.isCloudBackupConfigured = false
        mocks.preferences = {}
        mocks.setPreference.mockClear()
    })

    it('is due when the feature is on and no backup exists yet', () => {
        const { result } = renderHook(() => useCloudBackupIntroPrompt())

        expect(result.current.isDue).toBe(true)
    })

    it('stays hidden while the feature flag is off', () => {
        mocks.isCloudBackupEnabled = false

        const { result } = renderHook(() => useCloudBackupIntroPrompt())

        expect(result.current.isDue).toBe(false)
    })

    it('stays hidden once a backup is already set up', () => {
        mocks.isCloudBackupConfigured = true

        const { result } = renderHook(() => useCloudBackupIntroPrompt())

        expect(result.current.isDue).toBe(false)
    })

    it('records the intro as seen once a backup exists', () => {
        mocks.isCloudBackupConfigured = true

        renderHook(() => useCloudBackupIntroPrompt())

        expect(mocks.setPreference).toHaveBeenCalledWith(
            UserPreferences._cloudBackupIntroPrompt,
            true,
        )
    })

    it('leaves the preference alone while no backup exists', () => {
        mocks.isCloudBackupConfigured = false

        renderHook(() => useCloudBackupIntroPrompt())

        expect(mocks.setPreference).not.toHaveBeenCalled()
    })

    it('does not rewrite an answer that is already recorded', () => {
        mocks.isCloudBackupConfigured = true
        mocks.preferences[UserPreferences._cloudBackupIntroPrompt] = true

        renderHook(() => useCloudBackupIntroPrompt())

        expect(mocks.setPreference).not.toHaveBeenCalled()
    })

    it('records the intro as seen when a backup appears after mount', () => {
        mocks.isCloudBackupConfigured = false
        const { rerender } = renderHook(() => useCloudBackupIntroPrompt())
        expect(mocks.setPreference).not.toHaveBeenCalled()

        mocks.isCloudBackupConfigured = true
        rerender()

        expect(mocks.setPreference).toHaveBeenCalledWith(
            UserPreferences._cloudBackupIntroPrompt,
            true,
        )
    })
})
