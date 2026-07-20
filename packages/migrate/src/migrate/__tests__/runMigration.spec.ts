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
import { Platform } from 'react-native'
import type {
    LegacyMigrationData,
    MigrationService,
} from '@perawallet/wallet-extension-platform'

const emptyLegacyData = (): LegacyMigrationData =>
    ({
        auth: { pin: null },
        accounts: [],
        hdWallets: [],
    }) as unknown as LegacyMigrationData

import { runMigration } from '../runMigration'
import { runMigrationLoop } from '../runMigrationLoop'
import { runExtrasMigration } from '../runExtrasMigration'
import {
    ALL_MIGRATION_STEPS,
    MIGRATION_STEP_TARGET_VERSIONS,
} from '../stepVersions'
import type { MigrationDeps } from '../types'

vi.mock('../runMigrationLoop', () => ({ runMigrationLoop: vi.fn() }))
vi.mock('../runExtrasMigration', () => ({ runExtrasMigration: vi.fn() }))

const mockedRunMigrationLoop = runMigrationLoop as ReturnType<typeof vi.fn>
const mockedRunExtrasMigration = runExtrasMigration as ReturnType<typeof vi.fn>

const buildMigrationService = (overrides: Partial<MigrationService> = {}) => {
    const service: MigrationService = {
        hasLegacyData: vi.fn().mockResolvedValue(true),
        getLegacyData: vi.fn().mockResolvedValue(emptyLegacyData()),
        isMigrationComplete: vi.fn().mockResolvedValue(false),
        markMigrationComplete: vi.fn().mockResolvedValue(undefined),
        clearMigrationComplete: vi.fn().mockResolvedValue(undefined),
        getMigrationPlans: vi.fn().mockResolvedValue([]),
        simulateLegacyDatabase: vi.fn().mockResolvedValue(undefined),
        simulatePreSixxAccounts: vi.fn().mockResolvedValue(undefined),
        resetLegacyData: vi.fn().mockResolvedValue(undefined),
        getCompletedStepVersions: vi.fn().mockResolvedValue(null),
        setCompletedStepVersions: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    }
    return service
}

const buildDeps = (): MigrationDeps => ({
    importAccount: vi.fn() as unknown as MigrationDeps['importAccount'],
    createHdWalletAccount:
        vi.fn() as unknown as MigrationDeps['createHdWalletAccount'],
    createHDWalletKey: vi.fn() as unknown as MigrationDeps['createHDWalletKey'],
    hasSeedWithEntropy:
        vi.fn() as unknown as MigrationDeps['hasSeedWithEntropy'],
})

const successfulAccountResult = { imported: 1, skipped: 0, failed: [] }
const successfulExtrasResult = {
    preferences: true,
    swaps: true,
    deviceIdentifiers: true,
    contacts: { imported: 0, skipped: 0 },
    notifications: { muted: 0 },
    auth: {
        pinMigrated: false,
        biometricMigrated: false,
        lockoutMigrated: false,
    },
    stashed: { walletConnectHistoryBlobStashed: false },
    walletConnect: { imported: 0, skipped: 0 },
    passkeys: { imported: 0, skipped: 0 },
    failed: [],
}

const allStepsAtTarget = () =>
    Object.fromEntries(
        ALL_MIGRATION_STEPS.map(step => [
            step,
            MIGRATION_STEP_TARGET_VERSIONS[step],
        ]),
    )

describe('runMigration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockedRunMigrationLoop.mockResolvedValue(successfulAccountResult)
        mockedRunExtrasMigration.mockResolvedValue(successfulExtrasResult)
    })

    it('skips with incompleteReason "no-legacy-data" when hasLegacyData is false', async () => {
        const migration = buildMigrationService({
            hasLegacyData: vi.fn().mockResolvedValue(false),
        })

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('no-legacy-data')
        expect(result.accounts).toBeNull()
        expect(result.extras).toBeNull()
        expect(migration.getLegacyData).not.toHaveBeenCalled()
        expect(mockedRunMigrationLoop).not.toHaveBeenCalled()
        expect(mockedRunExtrasMigration).not.toHaveBeenCalled()
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('captures hasLegacyData throw without re-throwing', async () => {
        const migration = buildMigrationService({
            hasLegacyData: vi.fn().mockRejectedValue(new Error('boom')),
        })

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('has-legacy-data-threw')
        expect(result.error?.message).toBe('boom')
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('captures getLegacyData throw and skips both phases', async () => {
        const migration = buildMigrationService({
            getLegacyData: vi.fn().mockRejectedValue(new Error('decode broke')),
        })

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('get-legacy-data-threw')
        expect(result.error?.message).toBe('decode broke')
        expect(mockedRunMigrationLoop).not.toHaveBeenCalled()
        expect(mockedRunExtrasMigration).not.toHaveBeenCalled()
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('still runs extras (for migrated accounts) but reports incomplete when an account fails', async () => {
        mockedRunMigrationLoop.mockResolvedValue({
            imported: 4,
            skipped: 0,
            failed: [{ address: 'ADDR_FAIL', name: 'x', reason: 'unroutable' }],
        })
        const migration = buildMigrationService()

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('accounts-failed')
        expect(result.accounts?.failed).toHaveLength(1)
        // Extras run so the accounts that DID migrate get their passkeys/dApp
        // sessions; account-bound steps guard themselves against the failed one.
        expect(result.extras).toEqual(successfulExtrasResult)
        expect(mockedRunMigrationLoop).toHaveBeenCalledTimes(1)
        expect(mockedRunExtrasMigration).toHaveBeenCalledTimes(1)
        // Sentinel withheld so the failed account is retried next launch.
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('returns extras-failed when extras step reports any failure', async () => {
        mockedRunExtrasMigration.mockResolvedValue({
            ...successfulExtrasResult,
            failed: [{ step: 'contacts', reason: 'store unavailable' }],
        })
        const migration = buildMigrationService()

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('extras-failed')
        expect(result.extras?.failed).toHaveLength(1)
        expect(mockedRunMigrationLoop).toHaveBeenCalledTimes(1)
        expect(mockedRunExtrasMigration).toHaveBeenCalledTimes(1)
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('captures runMigrationLoop throw without re-throwing', async () => {
        mockedRunMigrationLoop.mockRejectedValue(new Error('kms exploded'))
        const migration = buildMigrationService()

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('accounts-threw')
        expect(result.error?.message).toBe('kms exploded')
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('captures runExtrasMigration throw and keeps the accounts result', async () => {
        mockedRunExtrasMigration.mockRejectedValue(new Error('zustand broke'))
        const migration = buildMigrationService()

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('extras-threw')
        expect(result.error?.message).toBe('zustand broke')
        expect(result.accounts).toEqual(successfulAccountResult)
        expect(migration.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('sets the sentinel only when both phases succeed', async () => {
        const migration = buildMigrationService()
        const platformSpy = vi
            .spyOn(Platform, 'OS', 'get')
            .mockReturnValue('ios' as typeof Platform.OS)

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(true)
        expect(result.incompleteReason).toBeNull()
        expect(result.accounts).toEqual(successfulAccountResult)
        expect(result.extras).toEqual(successfulExtrasResult)
        expect(mockedRunMigrationLoop).toHaveBeenCalledTimes(1)
        expect(mockedRunExtrasMigration).toHaveBeenCalledTimes(1)
        expect(migration.markMigrationComplete).toHaveBeenCalledTimes(1)
        expect(migration.markMigrationComplete).toHaveBeenCalledWith('ios')

        platformSpy.mockRestore()
    })

    it('passes accounts + hdWallets + deps into runMigrationLoop', async () => {
        const data: LegacyMigrationData = emptyLegacyData()
        const migration = buildMigrationService({
            getLegacyData: vi.fn().mockResolvedValue(data),
        })
        const deps = buildDeps()

        await runMigration(migration, deps)

        expect(mockedRunMigrationLoop).toHaveBeenCalledWith({
            accounts: data.accounts,
            hdWallets: data.hdWallets,
            importAccount: deps.importAccount,
            createHdWalletAccount: deps.createHdWalletAccount,
            createHDWalletKey: deps.createHDWalletKey,
            hasSeedWithEntropy: deps.hasSeedWithEntropy,
        })
    })

    it('captures markMigrationComplete throw without re-throwing', async () => {
        const migration = buildMigrationService({
            markMigrationComplete: vi
                .fn()
                .mockRejectedValue(new Error('disk full')),
        })

        const result = await runMigration(migration, buildDeps())

        expect(result.completed).toBe(false)
        expect(result.incompleteReason).toBe('mark-complete-threw')
        expect(result.error?.message).toBe('disk full')
    })
})

describe('step-version orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockedRunMigrationLoop.mockResolvedValue(successfulAccountResult)
        mockedRunExtrasMigration.mockResolvedValue(successfulExtrasResult)
    })

    it('short-circuits without reading legacy data when nothing is pending', async () => {
        const service = buildMigrationService({
            getCompletedStepVersions: vi
                .fn()
                .mockResolvedValue(allStepsAtTarget()),
        })
        const result = await runMigration(service, buildDeps())
        expect(result.completed).toBe(true)
        expect(service.getLegacyData).not.toHaveBeenCalled()
        expect(mockedRunMigrationLoop).not.toHaveBeenCalled()
    })

    it('skips the account loop when only extras steps are pending', async () => {
        const service = buildMigrationService({
            getCompletedStepVersions: vi.fn().mockResolvedValue({
                ...allStepsAtTarget(),
                deviceIdentifiers: 0,
            }),
        })
        mockedRunExtrasMigration.mockResolvedValue(successfulExtrasResult)
        const result = await runMigration(service, buildDeps())
        expect(mockedRunMigrationLoop).not.toHaveBeenCalled()
        expect(mockedRunExtrasMigration).toHaveBeenCalledWith(
            expect.anything(),
            ['deviceIdentifiers'],
        )
        expect(result.completed).toBe(true)
    })

    it('records versions for succeeded steps even when another step fails', async () => {
        const service = buildMigrationService()
        mockedRunMigrationLoop.mockResolvedValue(successfulAccountResult)
        mockedRunExtrasMigration.mockResolvedValue({
            ...successfulExtrasResult,
            failed: [{ step: 'passkeys', reason: 'boom' }],
        })
        const result = await runMigration(service, buildDeps())
        expect(result.completed).toBe(false)
        expect(service.setCompletedStepVersions).toHaveBeenCalledWith(
            expect.objectContaining({
                accounts: MIGRATION_STEP_TARGET_VERSIONS.accounts,
                deviceIdentifiers:
                    MIGRATION_STEP_TARGET_VERSIONS.deviceIdentifiers,
            }),
        )
        const written = (
            service.setCompletedStepVersions as ReturnType<typeof vi.fn>
        ).mock.calls[0][0]
        expect(written.passkeys).toBeUndefined()
        expect(service.markMigrationComplete).not.toHaveBeenCalled()
    })

    it('writes the sentinel only when every step reached its target', async () => {
        const service = buildMigrationService()
        mockedRunMigrationLoop.mockResolvedValue(successfulAccountResult)
        mockedRunExtrasMigration.mockResolvedValue(successfulExtrasResult)
        const result = await runMigration(service, buildDeps())
        expect(result.completed).toBe(true)
        expect(service.setCompletedStepVersions).toHaveBeenCalled()
        expect(service.markMigrationComplete).toHaveBeenCalledOnce()
    })
})
