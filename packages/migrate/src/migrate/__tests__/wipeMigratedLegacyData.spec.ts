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
        hydrationMock: {
            hasHydrated: vi.fn(() => true),
            finishListeners: [] as (() => void)[],
            onFinishHydration: vi.fn((listener: () => void) => {
                hydrationMock.finishListeners.push(listener)
                return vi.fn()
            }),
        },
        keystoreMock: {
            ids: new Set<string>(),
            parents: new Map<string, string>(),
        },
        gateMock: {
            legacyWipeBlock: null as {
                versions: MigrationStepVersions
                addresses: string[]
            } | null,
            setLegacyWipeBlock: vi.fn(),
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

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystore: () => ({ ready: Promise.resolve() }),
    getKeystoreStore: vi.fn(),
    getProvider: vi.fn(),
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
        gateMock.legacyWipeBlock = null
        gateMock.setLegacyWipeBlock.mockClear()
    })

    it('wipes once every step is done and each key is held by the keystore', async () => {
        const { service, data } = buildService()

        const outcome = await wipeMigratedLegacyData(service, 'algorand')

        expect(outcome).toBe('wiped')
        expect(service.wipeLegacyData).toHaveBeenCalledOnce()
        expect(gateMock.setLegacyWipeBlock).toHaveBeenCalledWith(null)
        expect(data.accounts[0].secretKey?.every(b => b === 0)).toBe(true)
        expect(data.auth.pin?.every(b => b === 0)).toBe(true)
    })

    it('keeps and remembers the refusal when a key-bearing account was removed', async () => {
        accountsStoreMock.accounts = []
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'keyed-account-removed',
        )
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
        expect(gateMock.setLegacyWipeBlock).toHaveBeenCalledWith({
            versions: MIGRATION_STEP_TARGET_VERSIONS,
            addresses: ['ADDR'],
        })
    })

    it('wipes when a removed account had no key in the legacy store', async () => {
        accountsStoreMock.accounts = []
        const { service } = buildService({
            data: legacyData({
                accounts: [legacyAccount({ secretKey: null })],
            }),
        })

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

    it('waits for the accounts store to rehydrate before checking', async () => {
        hydrationMock.hasHydrated.mockReturnValue(false)
        hydrationMock.finishListeners = []
        const { service } = buildService()

        const pending = wipeMigratedLegacyData(service, 'algorand')
        await vi.waitFor(() =>
            expect(hydrationMock.finishListeners).toHaveLength(1),
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()

        hydrationMock.finishListeners[0]()

        expect(await pending).toBe('wiped')
    })

    it('skips the session when the accounts store never finishes rehydrating', async () => {
        vi.useFakeTimers()
        try {
            hydrationMock.hasHydrated.mockReturnValue(false)
            hydrationMock.finishListeners = []
            hydrationMock.onFinishHydration.mockClear()
            const { service } = buildService()

            const pending = wipeMigratedLegacyData(service, 'algorand')
            await vi.advanceTimersByTimeAsync(30_000)

            expect(await pending).toBe('accounts-not-hydrated')
            expect(service.getLegacyData).not.toHaveBeenCalled()
            expect(service.wipeLegacyData).not.toHaveBeenCalled()
            const unsubscribe =
                hydrationMock.onFinishHydration.mock.results[0]?.value
            expect(unsubscribe).toHaveBeenCalledOnce()
        } finally {
            vi.useRealTimers()
        }
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
        expect(gateMock.setLegacyWipeBlock).toHaveBeenCalledWith({
            versions: MIGRATION_STEP_TARGET_VERSIONS,
            addresses: [],
        })
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
            expect(gateMock.setLegacyWipeBlock).toHaveBeenCalledWith({
                versions: MIGRATION_STEP_TARGET_VERSIONS,
                addresses: ['ADDR'],
            })
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

    it('does not read the legacy payload again while a remembered address still blocks', async () => {
        accountsStoreMock.accounts = [watchAccount('ADDR')]
        gateMock.legacyWipeBlock = {
            versions: { ...MIGRATION_STEP_TARGET_VERSIONS },
            addresses: ['ADDR'],
        }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'still-blocked',
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
    })

    it('stays blocked on an undecodable account until a step version moves', async () => {
        gateMock.legacyWipeBlock = {
            versions: { ...MIGRATION_STEP_TARGET_VERSIONS },
            addresses: [],
        }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'still-blocked',
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()
    })

    it('re-checks once a step version has moved on since the refusal', async () => {
        gateMock.legacyWipeBlock = {
            versions: { ...MIGRATION_STEP_TARGET_VERSIONS, accounts: 1 },
            addresses: [],
        }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('wiped')
    })

    it('re-checks and wipes once the user has re-imported the account with its key', async () => {
        gateMock.legacyWipeBlock = {
            versions: { ...MIGRATION_STEP_TARGET_VERSIONS },
            addresses: ['ADDR'],
        }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe('wiped')
    })

    it('stays blocked without re-reading after the user removes the watch account', async () => {
        accountsStoreMock.accounts = []
        gateMock.legacyWipeBlock = {
            versions: { ...MIGRATION_STEP_TARGET_VERSIONS },
            addresses: ['ADDR'],
        }
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'still-blocked',
        )
        expect(service.getLegacyData).not.toHaveBeenCalled()
    })

    it('keeps and remembers the refusal when the keystore lacks the account key', async () => {
        keystoreMock.ids = new Set()
        const { service } = buildService()

        expect(await wipeMigratedLegacyData(service, 'algorand')).toBe(
            'keys-missing-from-keystore',
        )
        expect(service.wipeLegacyData).not.toHaveBeenCalled()
        expect(gateMock.setLegacyWipeBlock).toHaveBeenCalledWith({
            versions: MIGRATION_STEP_TARGET_VERSIONS,
            addresses: ['ADDR'],
        })
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
