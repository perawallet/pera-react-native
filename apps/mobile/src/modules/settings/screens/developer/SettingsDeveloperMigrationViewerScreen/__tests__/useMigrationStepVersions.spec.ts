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
import { act, renderHook, waitFor } from '@testing-library/react'

const { migrationService } = vi.hoisted(() => ({
    migrationService: { tag: 'migration-service' },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ migration: migrationService }),
}))

vi.mock('@perawallet/wallet-core-migrate', () => ({
    ALL_MIGRATION_STEPS: ['accounts', 'preferences', 'contacts'],
    MIGRATION_STEP_TARGET_VERSIONS: {
        accounts: 2,
        preferences: 1,
        contacts: 1,
    },
    resolveCompletedStepVersions: vi.fn(),
    getPendingSteps: vi.fn(),
}))

import {
    getPendingSteps,
    resolveCompletedStepVersions,
} from '@perawallet/wallet-core-migrate'
import { useMigrationStepVersions } from '../useMigrationStepVersions'

describe('useMigrationStepVersions', () => {
    beforeEach(() => {
        vi.mocked(resolveCompletedStepVersions).mockReset()
        vi.mocked(getPendingSteps).mockReset()
        vi.mocked(resolveCompletedStepVersions).mockResolvedValue({
            accounts: 1,
            preferences: 1,
        })
        vi.mocked(getPendingSteps).mockResolvedValue(['accounts', 'contacts'])
    })

    it('maps every step to its recorded/target versions and pending flag', async () => {
        const { result } = renderHook(() => useMigrationStepVersions())

        expect(result.current.isLoading).toBe(true)

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(resolveCompletedStepVersions).toHaveBeenCalledWith(
            migrationService,
        )
        expect(getPendingSteps).toHaveBeenCalledWith(migrationService)
        expect(result.current.steps).toEqual([
            { name: 'accounts', recorded: 1, target: 2, isPending: true },
            { name: 'preferences', recorded: 1, target: 1, isPending: false },
            // Never-recorded steps read as version 0 (`recorded ?? 0`).
            { name: 'contacts', recorded: 0, target: 1, isPending: true },
        ])
    })

    it('re-reads the step record on refresh', async () => {
        const { result } = renderHook(() => useMigrationStepVersions())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        vi.mocked(resolveCompletedStepVersions).mockResolvedValue({
            accounts: 2,
            preferences: 1,
            contacts: 1,
        })
        vi.mocked(getPendingSteps).mockResolvedValue([])

        act(() => result.current.refresh())

        await waitFor(() =>
            expect(result.current.steps).toEqual([
                { name: 'accounts', recorded: 2, target: 2, isPending: false },
                {
                    name: 'preferences',
                    recorded: 1,
                    target: 1,
                    isPending: false,
                },
                { name: 'contacts', recorded: 1, target: 1, isPending: false },
            ]),
        )
    })
})
