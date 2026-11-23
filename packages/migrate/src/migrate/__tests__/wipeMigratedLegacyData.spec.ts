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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { MigrationStepVersions } from '@perawallet/wallet-extension-platform'

const { accountsStoreMock, hydrationMock, keystoreMock, gateMock } = vi.hoisted(
    () => ({
        accountsStoreMock: { accounts: [] as WalletAccount[] },
        hydrationMock: { hasHydrated: vi.fn(() => true) },
        keystoreMock: {
            ids: new Set<string>(),
            parents: new Map<string, string>(),
        },
        gateMock: {
            wipeBlockedAtVersions: null as MigrationStepVersions | null,
            setWipeBlockedAtVersions: vi.fn(),
        },
    }),
)

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => accountsStoreMock,
        persist: hydrationMock,
    },
    chainAccountOf: (account: WalletAccount, chainId: string) =>
        account.chains[chainId as 'algorand'],
    isWatchAccount: (account: { custody?: { kind?: string } }) =>
        account.custody?.kind === 'watch',
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    hasSecret: (id: string) => keystoreMock.ids.has(id),
    getSecretMetadata: (id: string) => {
        const parentKeyId = keystoreMock.parents.get(id)
        return parentKeyId ? { parentKeyId } : {}
    },
}))

vi.mock('../../store', () => ({
    useMigrationGateStore: { getState: () => gateMock },
}))

import type {
    LegacyAccount,
    LegacyMigrationData,
    MigrationService,
} from '@perawallet/wallet-extension-platform'
import { MIGRATION_STEP_TARGET_VERSIONS } from '../stepVersions'
import { wipeMigratedLegacyData } from '../wipeMigratedLegacyData'

const legacyAccount = (overrides: Partial<LegacyAccount> = {}): LegacyAccount =>
    ({
        address: 'ADDR',
        secretKey: new Uint8Array(32).fill(1),
        hdSeedId: null,
        ...overrides,
    }) as LegacyAccount

const legacyData = (
    overrides: Partial<LegacyMigrationData> = {},
): LegacyMigrationData =>
    ({
        auth: { pin: new Uint8Array(6).fill(9) },
        accounts: [legacyAccount()],
        undecodableAccounts: [],
        hdSeeds: [],
        ...overrides,
    }) as unknown as LegacyMigrationData

const localAccount = (address: string): WalletAccount => ({
    id: `id-${address}`,
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address, keyPairId: `kp-${address}` } },
})

const watchAccount = (address: string): WalletAccount => ({
    id: `id-${address}`,
    custody: { kind: 'watch' },
    chains: { algorand: { address } },
})

const buildService = (
    overrides: {
        hasLegacyData?: boolean
        stepVersions?: MigrationStepVersions
        data?: LegacyMigrationData
    } = {},
) => {
    const data = overrides.data ?? legacyData()
    return {
        data,
        service: {
            hasLegacyData: vi
                .fn()
                .mockResolvedValue(overrides.hasLegacyData ?? true),
            getLegacyData: vi.fn().mockResolvedValue(data),
            getCompletedStepVersions: vi
                .fn()
                .mockResolvedValue(
                    overrides.stepVersions ?? MIGRATION_STEP_TARGET_VERSIONS,
                ),
            isMigrationComplete: vi.fn().mockResolvedValue(true),
            wipeLegacyData: vi.fn().mockResolvedValue(undefined),
        } as unknown as MigrationService,
    }
}

describe('wipeMigratedLegacyData', () => {
    beforeEach(() => {
        accountsStoreMock.accounts = [localAccount('ADDR')]
        hydrationMock.hasHydrated.mockReturnValue(true)
        keystoreMock.ids = new Set(['kp-ADDR'])
        keystoreMock.parents = new Map()
        gateMock.wipeBlockedAtVersions = null
        gateMock.setWipeBlockedAtVersions.mockClear()
    })

    it('wipes once every step is done and each key is held by the keystore', async () => {
        const { service, data } = buildService()

        const outcome = await wipeMigratedLegacyData(service, 'algorand')

        expect(outcome).toBe('wiped')
        expect(service.wipeLegacyData).toHaveBeenCalledOnce()
        expect(gateMock.setWipeBlockedAtVersions).toHaveBeenCalledWith(null)
        expect(data.accounts[0].secretKey?.every(b => b === 0)).toBe(true)
        expect(data.auth.pin?.every(b => b === 0)).toBe(true)
    })

    it('wipes when the user has since removed a migrated account', async () => {
        accountsStoreMock.accounts = []
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('wiped')
    })

    it('skips without reading the store when there is no legacy data', async () => {
        const { service } = buildService({ hasLegacyData: false })

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'no-legacy-data',
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
    })

    it('keeps the store before the accounts store has rehydrated', async () => {
        hydrationMock.hasHydrated.mockReturnValue(false)
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'accounts-not-hydrated',
        )
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
    })

    it('keeps the store while a step is below its target version', async () => {
        const { service } = buildService({
            stepVersions: { ...MIGRATION_STEP_TARGET_VERSIONS, accounts: 1 },
        })

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'steps-pending',
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
    })

    it('keeps and remembers the refusal while an account could not be decoded', async () => {
        const { service, data } = buildService({
            data: legacyData({
                undecodableAccounts: [
                    { address: 'BAD', name: 'Bad', error: 'boom' },
                ],
            }),
        })

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'undecodable-accounts',
        )
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
        expect(gateMock.setWipeBlockedAtVersions).toHaveBeenCalledWith(
            MIGRATION_STEP_TARGET_VERSIONS,
        )
        expect(data.accounts[0].secretKey?.every(b => b === 0)).toBe(true)
    })

    it.each([
        ['an algo25 key', legacyAccount()],
        [
            'an HD wallet',
            legacyAccount({ secretKey: null, hdSeedId: 'wallet-1' }),
        ],
    ])(
        'keeps and remembers the refusal while %s is held only as watch',
        async (_label, account) => {
            accountsStoreMock.accounts = [watchAccount('ADDR')]
            const { service } = buildService({
                data: legacyData({ accounts: [account] }),
            })

            expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
                'keys-held-as-watch',
            )
            expect(service.wipeLegacyData).not.toHaveBeenCalled()
            expect(gateMock.setWipeBlockedAtVersions).toHaveBeenCalledWith(
                MIGRATION_STEP_TARGET_VERSIONS,
            )
        },
    )

    it('wipes when a keyless legacy account is held as watch', async () => {
        accountsStoreMock.accounts = [watchAccount('ADDR')]
        const { service } = buildService({
            data: legacyData({
                accounts: [legacyAccount({ secretKey: null })],
            }),
        })

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('wiped')
    })

    it('does not read the legacy payload again at the step versions it was refused at', async () => {
        gateMock.wipeBlockedAtVersions = { ...MIGRATION_STEP_TARGET_VERSIONS }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'blocked-until-steps-change',
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
    })

    it('re-checks once a step version has moved on since the refusal', async () => {
        gateMock.wipeBlockedAtVersions = {
            ...MIGRATION_STEP_TARGET_VERSIONS,
            accounts: 1,
        }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('wiped')
    })

    it('keeps the store, without remembering it, when the keystore lacks the account key', async () => {
        keystoreMock.ids = new Set()
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'keys-missing-from-keystore',
        )
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
        expect(gateMock.setWipeBlockedAtVersions).not.toHaveBeenCalled()
    })

    it('keeps the store when an HD key is held but its seed is gone', async () => {
        keystoreMock.parents = new Map([['kp-ADDR', 'seed-1']])
        const { service } = buildService({
            data: legacyData({
                accounts: [
                    legacyAccount({ secretKey: null, hdSeedId: 'wallet-1' }),
                ],
            }),
        })

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'keys-missing-from-keystore',
        )

        keystoreMock.ids.add('seed-1')
        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('wiped')
    })

    it('reports failure instead of throwing when the native wipe throws', async () => {
        const { service } = buildService()
        vi.mocked(service.wipeLegacyData).mockRejectedValue(new Error('io'))

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('failed')
    })
})
