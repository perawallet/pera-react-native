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
import type {
    MigrationDevTools,
    MigrationPlanSummary,
} from '@perawallet/wallet-extension-platform'
import { useMigrationSimulatorStore } from '../useMigrationSimulatorStore'

const mocks = vi.hoisted(() => ({
    devTools: undefined as MigrationDevTools | undefined,
    getMigrationPlans: vi.fn(),
    resetLegacyData: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        migration: {
            devTools: mocks.devTools,
            getMigrationPlans: mocks.getMigrationPlans,
            resetLegacyData: mocks.resetLegacyData,
        },
    }),
}))

const plan: MigrationPlanSummary = {
    dbName: 'pera.db',
    targetVersion: 5,
    oldestSupported: 2,
    readerImpact: 'none',
    migrations: [],
}

const createDevTools = (): MigrationDevTools => ({
    simulateLegacyDatabase: vi.fn().mockResolvedValue(undefined),
    simulatePreSixxAccounts: vi.fn().mockResolvedValue(undefined),
})

describe('useMigrationSimulatorStore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.devTools = undefined
        mocks.getMigrationPlans.mockResolvedValue([plan])
        useMigrationSimulatorStore.getState().resetState()
    })

    it('simulates each plan at its selected version through the dev tools', async () => {
        const devTools = createDevTools()
        mocks.devTools = devTools
        await useMigrationSimulatorStore.getState().loadPlansIfNeeded()
        useMigrationSimulatorStore.getState().setSelectedVersion('pera.db', 3)

        await useMigrationSimulatorStore.getState().generate()

        expect(devTools.simulateLegacyDatabase).toHaveBeenCalledWith({
            dbName: 'pera.db',
            version: 3,
            includeUnroutableAccounts: false,
            includeAuthState: false,
        })
        const state = useMigrationSimulatorStore.getState()
        expect(state.results[0].outcome).toMatchObject({
            kind: 'success',
            version: 3,
        })
        expect(state.lastGenerated['pera.db']?.version).toBe(3)
        expect(state.isWorking).toBe(false)
    })

    it('records a failed simulation as an error row', async () => {
        const devTools = createDevTools()
        vi.mocked(devTools.simulateLegacyDatabase).mockRejectedValue(
            new Error('disk full'),
        )
        mocks.devTools = devTools
        await useMigrationSimulatorStore.getState().loadPlansIfNeeded()

        await useMigrationSimulatorStore.getState().generate()

        expect(useMigrationSimulatorStore.getState().results).toEqual([
            {
                dbName: 'pera.db',
                outcome: { kind: 'error', message: 'disk full' },
            },
        ])
    })

    it('does nothing when the platform exposes no dev tools', async () => {
        await useMigrationSimulatorStore.getState().loadPlansIfNeeded()

        await useMigrationSimulatorStore.getState().generate()
        await useMigrationSimulatorStore.getState().generatePreSixxAccounts()

        const state = useMigrationSimulatorStore.getState()
        expect(state.results).toEqual([])
        expect(state.isWorking).toBe(false)
    })

    it('writes the pre-6.x blob through the dev tools', async () => {
        const devTools = createDevTools()
        mocks.devTools = devTools

        await useMigrationSimulatorStore.getState().generatePreSixxAccounts()

        expect(devTools.simulatePreSixxAccounts).toHaveBeenCalledOnce()
        expect(
            useMigrationSimulatorStore.getState().results[0].outcome,
        ).toMatchObject({ kind: 'done', detail: 'blob written' })
    })
})
