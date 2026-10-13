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

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MigrationDevTools } from '@perawallet/wallet-extension-platform'
import { useMigrationSimulator } from '../useMigrationSimulator'
import { useMigrationSimulatorStore } from '../useMigrationSimulatorStore'

const mocks = vi.hoisted(() => ({
    devTools: undefined as MigrationDevTools | undefined,
    getMigrationPlans: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        migration: {
            devTools: mocks.devTools,
            getMigrationPlans: mocks.getMigrationPlans,
        },
    }),
}))

describe('useMigrationSimulator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.devTools = undefined
        mocks.getMigrationPlans.mockResolvedValue([])
        useMigrationSimulatorStore.getState().resetState()
    })

    it('reports simulation as supported when the platform exposes dev tools', async () => {
        mocks.devTools = {
            simulateLegacyDatabase: vi.fn(),
            simulatePreSixxAccounts: vi.fn(),
        }

        const { result } = renderHook(() => useMigrationSimulator())

        await waitFor(() => expect(result.current.isLoadingPlans).toBe(false))
        expect(result.current.canSimulate).toBe(true)
    })

    it('reports simulation as unsupported when the platform has no dev tools', async () => {
        const { result } = renderHook(() => useMigrationSimulator())

        await waitFor(() => expect(result.current.isLoadingPlans).toBe(false))
        expect(result.current.canSimulate).toBe(false)
    })
})
