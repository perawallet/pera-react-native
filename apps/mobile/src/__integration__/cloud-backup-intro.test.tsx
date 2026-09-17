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
import { fireEvent, screen } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useCloudBackupStore } from '@perawallet/wallet-core-backup'
import { UserPreferences } from '@constants/user-preferences'

const mocks = vi.hoisted(() => {
    const state = { preferences: {} as Record<string, unknown> }
    return Object.assign(state, {
        getPreference: (key: string) => state.preferences[key] ?? null,
        setPreference: (key: string, value: unknown) => {
            state.preferences[key] = value
        },
    })
})

vi.mock('@perawallet/wallet-core-settings', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-settings')
    >()),
    usePreferences: () => ({
        getPreference: mocks.getPreference,
        setPreference: mocks.setPreference,
    }),
}))

import { CloudBackupStackNavigator } from '@modules/cloud-backup/routes'

const renderCloudBackup = () =>
    renderWithNavigation(CloudBackupStackNavigator, 'CloudBackupSettings')

describe('Flow: cloud backup intro', () => {
    beforeEach(() => {
        mocks.preferences = {}
        useCloudBackupStore.getState().resetState()
    })

    it('shows the intro on the first visit and lands on the options screen', async () => {
        renderCloudBackup()

        fireEvent.click(
            await screen.findByTestId('cloud_backup_intro_continue_button'),
        )

        expect(await screen.findByTestId('cloud_backup_screen')).toBeTruthy()
        expect(mocks.preferences[UserPreferences.cloudBackupIntroSeen]).toBe(
            true,
        )
    })

    it('goes straight to the options screen once the intro has been seen', async () => {
        mocks.preferences = {
            [UserPreferences.cloudBackupIntroSeen]: true,
        }

        renderCloudBackup()

        expect(await screen.findByTestId('cloud_backup_screen')).toBeTruthy()
        expect(screen.queryByTestId('cloud_backup_intro_screen')).toBeNull()
    })

    it('keeps the intro on a later visit when the user backed out without continuing', async () => {
        const { unmount } = renderCloudBackup()

        expect(
            await screen.findByTestId('cloud_backup_intro_screen'),
        ).toBeTruthy()

        unmount()

        renderCloudBackup()

        expect(
            await screen.findByTestId('cloud_backup_intro_screen'),
        ).toBeTruthy()
        expect(UserPreferences.cloudBackupIntroSeen in mocks.preferences).toBe(
            false,
        )
    })

    it('sends a configured user straight to the overview, never the intro, and retires it', async () => {
        useCloudBackupStore.getState().setConfigured({
            backupId: 'test-backup-id',
            salt: 'test-salt',
            deviceId: 'test-device-id',
        })

        renderCloudBackup()

        expect(
            await screen.findByTestId('cloud_backup_overview_screen'),
        ).toBeTruthy()
        expect(screen.queryByTestId('cloud_backup_intro_screen')).toBeNull()
        expect(mocks.preferences[UserPreferences.cloudBackupIntroSeen]).toBe(
            true,
        )
    })
})
