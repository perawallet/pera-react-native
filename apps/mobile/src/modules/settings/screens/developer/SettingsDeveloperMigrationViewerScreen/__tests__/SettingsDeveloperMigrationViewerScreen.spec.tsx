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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'

const {
    mockScreenHook,
    mockRunMigrationHook,
    mockSnapshot,
    mockStepVersionsHook,
} = vi.hoisted(() => ({
    mockScreenHook: vi.fn(),
    mockRunMigrationHook: vi.fn(),
    mockSnapshot: vi.fn(),
    mockStepVersionsHook: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('../useSettingsDeveloperMigrationViewerScreen', () => ({
    useSettingsDeveloperMigrationViewerScreen: mockScreenHook,
}))

vi.mock('../useRunMigration', () => ({
    useRunMigration: mockRunMigrationHook,
}))

vi.mock('../useRNMigrationSnapshot', () => ({
    useRNMigrationSnapshot: mockSnapshot,
}))

vi.mock('../useMigrationStepVersions', () => ({
    useMigrationStepVersions: mockStepVersionsHook,
}))

import { SettingsDeveloperMigrationViewerScreen } from '../SettingsDeveloperMigrationViewerScreen'

const idleScreen = (
    overrides: Partial<ReturnType<typeof mockScreenHook>> = {},
) => ({
    data: null,
    isLoading: false,
    error: null,
    isMigrationComplete: false,
    refresh: vi.fn(),
    ...overrides,
})

const idleRunMigration = (
    overrides: Partial<ReturnType<typeof mockRunMigrationHook>> = {},
) => ({
    run: vi.fn().mockResolvedValue({}),
    isMigrating: false,
    result: null,
    error: null,
    ...overrides,
})

const idleStepVersions = (
    overrides: Partial<ReturnType<typeof mockStepVersionsHook>> = {},
) => ({
    steps: [],
    isLoading: false,
    refresh: vi.fn(),
    ...overrides,
})

const emptySnapshot = () => ({
    preferences: {},
    auth: {},
    accountsByAddress: new Map(),
    manualAccountOrder: [],
    contactsByAddress: new Map(),
    notificationDisabledAccounts: new Set<string>(),
    deviceIDs: { mainnet: null, testnet: null },
    deviceIdOrigins: { mainnet: null, testnet: null },
    legacyStash: {},
})

beforeEach(() => {
    mockScreenHook.mockReset()
    mockRunMigrationHook.mockReset()
    mockSnapshot.mockReset()
    mockStepVersionsHook.mockReset()
    mockRunMigrationHook.mockReturnValue(idleRunMigration())
    mockSnapshot.mockReturnValue(emptySnapshot())
    mockStepVersionsHook.mockReturnValue(idleStepVersions())
})

describe('SettingsDeveloperMigrationViewerScreen', () => {
    it('renders a loading state while data is being fetched', () => {
        mockScreenHook.mockReturnValue(idleScreen({ isLoading: true }))

        render(<SettingsDeveloperMigrationViewerScreen />)

        expect(screen.getByText('Loading…')).toBeTruthy()
    })

    it('renders the error state with the error message and a refresh button', () => {
        const refresh = vi.fn()
        mockScreenHook.mockReturnValue(
            idleScreen({
                error: new Error('load failed'),
                refresh,
            }),
        )

        render(<SettingsDeveloperMigrationViewerScreen />)

        expect(screen.getByText('Failed to read legacy data')).toBeTruthy()
        expect(screen.getByText('load failed')).toBeTruthy()

        fireEvent.click(screen.getByText('Refresh'))
        expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('renders nothing when data is null with no loading and no error', () => {
        mockScreenHook.mockReturnValue(idleScreen())

        const { container } = render(<SettingsDeveloperMigrationViewerScreen />)

        expect(container.textContent).toBe('')
    })

    it('prioritises loading state over error state', () => {
        mockScreenHook.mockReturnValue(
            idleScreen({
                isLoading: true,
                error: new Error('should not be shown'),
            }),
        )

        render(<SettingsDeveloperMigrationViewerScreen />)

        expect(screen.getByText('Loading…')).toBeTruthy()
        expect(screen.queryByText('Failed to read legacy data')).toBeNull()
        expect(screen.queryByText('should not be shown')).toBeNull()
    })
})
