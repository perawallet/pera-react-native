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

const { accountsStoreMock, loggerMock } = vi.hoisted(() => ({
    accountsStoreMock: {
        accounts: [] as Array<{
            address: string
            type?: string
            rekeyAddress?: string
        }>,
    },
    loggerMock: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: { getState: () => accountsStoreMock },
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
        quantum: 'quantum',
    },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: loggerMock,
}))

vi.mock('../migrateLegacyAccount', () => ({
    migrateLegacyAccount: vi.fn(),
    classifyLegacyAccountRoute: vi.fn(() => 'algo25'),
    isKeylessLegacyAccount: vi.fn(
        (a: { type: string; joint: unknown; ledger: unknown }) =>
            a.type === 'watch' || a.joint !== null || a.ledger !== null,
    ),
}))

vi.mock('../accountStoreOps', () => ({
    addKeylessAccountToStore: vi.fn(),
    applyAllLegacyMetadata: vi.fn(),
    applyLegacyAccountOrder: vi.fn(),
    applyRekeyAddressToStoreAccount: vi.fn(),
    markLegacyBackedUpAccounts: vi.fn(),
    removeAccountFromStore: vi.fn(),
}))

import type {
    LegacyAccount,
    LegacyHDWallet,
} from '@perawallet/wallet-extension-platform'
import { runMigrationLoop } from '../runMigrationLoop'
import {
    migrateLegacyAccount,
    classifyLegacyAccountRoute,
} from '../migrateLegacyAccount'
import {
    addKeylessAccountToStore,
    applyAllLegacyMetadata,
    applyLegacyAccountOrder,
    applyRekeyAddressToStoreAccount,
    markLegacyBackedUpAccounts,
    removeAccountFromStore,
} from '../accountStoreOps'
import type { MigrationDeps } from '../types'

const buildAccount = (overrides: Partial<LegacyAccount> = {}): LegacyAccount =>
    ({
        address: 'ADDR',
        name: '',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: new Uint8Array(32).fill(1),
        hdWalletId: null,
        ledger: null,
        joint: null,
        authAddress: null,
        ...overrides,
    }) as LegacyAccount

const watchAccount = (
    address: string,
): { address: string; type: string; rekeyAddress?: string } => ({
    address,
    type: 'watch',
})

const algo25Account = (address: string): { address: string; type: string } => ({
    address,
    type: 'algo25',
})

const buildDeps = (): MigrationDeps => ({
    importAccount: vi.fn() as unknown as MigrationDeps['importAccount'],
    createHdWalletAccount:
        vi.fn() as unknown as MigrationDeps['createHdWalletAccount'],
    createHDWalletKey: vi.fn() as unknown as MigrationDeps['createHDWalletKey'],
    hasSeedWithEntropy:
        vi.fn() as unknown as MigrationDeps['hasSeedWithEntropy'],
})

beforeEach(() => {
    accountsStoreMock.accounts = []
    vi.mocked(migrateLegacyAccount).mockReset()
    vi.mocked(classifyLegacyAccountRoute).mockReset()
    vi.mocked(applyAllLegacyMetadata).mockReset()
    vi.mocked(applyLegacyAccountOrder).mockReset()
    vi.mocked(markLegacyBackedUpAccounts).mockReset()
    vi.mocked(addKeylessAccountToStore).mockReset()
    vi.mocked(removeAccountFromStore).mockReset()
    vi.mocked(applyRekeyAddressToStoreAccount).mockReset()
    loggerMock.error.mockReset()
    vi.mocked(classifyLegacyAccountRoute).mockReturnValue('algo25')
})

describe('runMigrationLoop', () => {
    it('returns an empty summary and still applies metadata + order when input is empty', async () => {
        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [],
            hdWallets: [],
        })

        expect(result).toEqual({ imported: 0, skipped: 0, failed: [] })
        expect(applyAllLegacyMetadata).toHaveBeenCalledWith([])
        expect(applyLegacyAccountOrder).toHaveBeenCalledWith([])
        expect(migrateLegacyAccount).not.toHaveBeenCalled()
    })

    it('skips accounts whose address is already in the wallet store', async () => {
        accountsStoreMock.accounts = [{ address: 'ADDR_EXISTING' }]
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'ADDR_NEW',
        } as never)

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [
                buildAccount({ address: 'ADDR_EXISTING' }),
                buildAccount({ address: 'ADDR_NEW' }),
            ],
            hdWallets: [],
        })

        expect(result.skipped).toBe(1)
        expect(result.imported).toBe(1)
        expect(migrateLegacyAccount).toHaveBeenCalledTimes(1)
    })

    it('records imported accounts as MigratedAccountPair entries on the metadata batch', async () => {
        const legacy = buildAccount({ address: 'ADDR_NEW', name: 'N' })
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'ADDR_NEW',
        } as never)

        await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        const batch = vi.mocked(applyAllLegacyMetadata).mock.calls[0][0]
        expect(batch).toEqual([{ created: { address: 'ADDR_NEW' }, legacy }])
    })

    it('forwards the migrated pairs and the injected marker to markLegacyBackedUpAccounts', async () => {
        const legacy = buildAccount({ address: 'ADDR_NEW' })
        const markAccountBackedUp = vi.fn()
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'ADDR_NEW',
        } as never)

        await runMigrationLoop({
            ...buildDeps(),
            markAccountBackedUp,
            accounts: [legacy],
            hdWallets: [],
        })

        expect(markLegacyBackedUpAccounts).toHaveBeenCalledWith(
            [{ created: { address: 'ADDR_NEW' }, legacy }],
            markAccountBackedUp,
        )
    })

    it('passes hdWalletsById built from the input hd wallets to migrateLegacyAccount', async () => {
        const hd: LegacyHDWallet = {
            walletId: 'wallet-1',
            name: null,
            entropy: new Uint8Array(32).fill(1),
            keys: [],
        }
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'ADDR',
        } as never)

        await runMigrationLoop({
            ...buildDeps(),
            accounts: [buildAccount()],
            hdWallets: [hd],
        })

        const args = vi.mocked(migrateLegacyAccount).mock.calls[0][0]
        expect(args.hdWalletsById.get('wallet-1')).toBe(hd)
        expect(args.importedHdRoots).toBeInstanceOf(Map)
        expect(args.importedHdRoots.size).toBe(0)
    })

    it('captures a failure and continues with the rest of the loop', async () => {
        vi.mocked(migrateLegacyAccount)
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ address: 'ADDR_OK' } as never)

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [
                buildAccount({ address: 'ADDR_FAIL', name: 'F' }),
                buildAccount({ address: 'ADDR_OK', name: 'OK' }),
            ],
            hdWallets: [],
        })

        expect(result.imported).toBe(1)
        expect(result.failed).toEqual([
            {
                address: 'ADDR_FAIL',
                name: 'F',
                reason: '[algo25] Error: boom',
            },
        ])
        expect(loggerMock.error).toHaveBeenCalledWith(
            'Legacy account migration failed',
            expect.objectContaining({ address: 'ADDR_FAIL', route: 'algo25' }),
        )
    })

    it('formats non-Error throws via String() with route prefix', async () => {
        vi.mocked(migrateLegacyAccount).mockRejectedValueOnce(
            'kaboom' as unknown as Error,
        )
        vi.mocked(classifyLegacyAccountRoute).mockReturnValue('hd')

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [buildAccount({ address: 'ADDR_BAD', name: 'X' })],
            hdWallets: [],
        })

        expect(result.failed[0].reason).toBe('[hd] Unknown: kaboom')
    })

    it('treats imports as deduplicated against later legacy entries that share the address', async () => {
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'ADDR_NEW',
        } as never)

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [
                buildAccount({ address: 'ADDR_NEW' }),
                buildAccount({ address: 'ADDR_NEW' }),
            ],
            hdWallets: [],
        })

        expect(result.imported).toBe(1)
        expect(result.skipped).toBe(1)
        expect(migrateLegacyAccount).toHaveBeenCalledTimes(1)
    })

    it('orders accounts as key-bearing → keyless independent → multisig', async () => {
        const order: string[] = []
        vi.mocked(migrateLegacyAccount).mockImplementation(async args => {
            order.push(args.account.address)
            return { address: args.account.address } as never
        })

        const algo25 = buildAccount({
            address: 'ALGO25',
            secretKey: new Uint8Array(32),
        })
        const watch = buildAccount({
            address: 'WATCH',
            type: 'watch',
            secretKey: null,
        })
        const joint = buildAccount({
            address: 'JOINT',
            secretKey: null,
            joint: {
                threshold: 1,
                version: 1,
                participants: ['P'],
            },
        })

        await runMigrationLoop({
            ...buildDeps(),
            accounts: [joint, watch, algo25],
            hdWallets: [],
        })

        expect(order).toEqual(['ALGO25', 'WATCH', 'JOINT'])
    })

    it('passes the original input array to applyLegacyAccountOrder, not the reordered one', async () => {
        const accounts = [
            buildAccount({ address: 'A', preferredOrder: 0 }),
            buildAccount({ address: 'B', preferredOrder: 1 }),
        ]
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'X',
        } as never)

        await runMigrationLoop({
            ...buildDeps(),
            accounts,
            hdWallets: [],
        })

        expect(applyLegacyAccountOrder).toHaveBeenCalledWith(accounts)
    })

    it('records undecodable accounts as failures without invoking migrateLegacyAccount', async () => {
        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [],
            hdWallets: [],
            undecodableAccounts: [
                {
                    address: 'ADDR_UNDECODABLE',
                    name: 'Corrupt',
                    error: 'Invalid string. Length must be a multiple of 4',
                },
            ],
        })

        expect(result.failed).toEqual([
            {
                address: 'ADDR_UNDECODABLE',
                name: 'Corrupt',
                reason: '[undecodable] Invalid string. Length must be a multiple of 4',
            },
        ])
        expect(migrateLegacyAccount).not.toHaveBeenCalled()
    })

    it('skips an undecodable account whose address is already in the wallet store', async () => {
        accountsStoreMock.accounts = [{ address: 'ADDR_EXISTING' }]

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [],
            hdWallets: [],
            undecodableAccounts: [
                { address: 'ADDR_EXISTING', name: 'Already', error: 'boom' },
            ],
        })

        expect(result.failed).toEqual([])
        expect(result.skipped).toBe(1)
    })

    it('upgrades an existing watch account when the legacy payload now carries a key', async () => {
        accountsStoreMock.accounts = [watchAccount('UPGRADEME')]
        const legacy = buildAccount({
            address: 'UPGRADEME',
            type: 'standard',
            secretKey: new Uint8Array(64),
            authAddress: null,
        })
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'UPGRADEME',
        } as never)

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(migrateLegacyAccount).toHaveBeenCalledOnce()
        expect(result.imported).toBe(1)
        expect(removeAccountFromStore).toHaveBeenCalledWith('UPGRADEME')
        expect(applyRekeyAddressToStoreAccount).not.toHaveBeenCalled()
        expect(
            accountsStoreMock.accounts.filter(a => a.address === 'UPGRADEME'),
        ).toHaveLength(1)
    })

    it('mirrors the legacy authAddress onto a key-bearing import that lacks it', async () => {
        accountsStoreMock.accounts = [watchAccount('UPGRADEME')]
        const legacy = buildAccount({
            address: 'UPGRADEME',
            type: 'standard',
            secretKey: new Uint8Array(64).fill(3),
            authAddress: 'AUTH',
        })
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'UPGRADEME',
        } as never)

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(result.imported).toBe(1)
        expect(applyRekeyAddressToStoreAccount).toHaveBeenCalledWith(
            'UPGRADEME',
            'AUTH',
        )
    })

    it('leaves rekeyAddress alone when the import already carries the mirror', async () => {
        const legacy = buildAccount({
            address: 'WATCHED',
            type: 'watch',
            secretKey: null,
            authAddress: 'AUTH',
        })
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'WATCHED',
            rekeyAddress: 'AUTH',
        } as never)

        await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(applyRekeyAddressToStoreAccount).not.toHaveBeenCalled()
    })

    it('restores the removed watch account when the reconciling reimport throws', async () => {
        const watch = watchAccount('RECONCILE')
        accountsStoreMock.accounts = [watch]
        const legacy = buildAccount({
            address: 'RECONCILE',
            type: 'standard',
            secretKey: new Uint8Array(64).fill(2),
            authAddress: null,
        })
        vi.mocked(migrateLegacyAccount).mockRejectedValueOnce(
            new Error('kms exploded'),
        )

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(removeAccountFromStore).toHaveBeenCalledWith('RECONCILE')
        // The visible watch account must be re-added before the failure is
        // recorded, so a transient import error never orphans the user's account.
        expect(addKeylessAccountToStore).toHaveBeenCalledWith(watch)
        expect(result.imported).toBe(0)
        expect(result.failed).toEqual([
            {
                address: 'RECONCILE',
                name: '',
                reason: '[algo25] Error: kms exploded',
            },
        ])
    })

    it('does not re-add anything when a non-reconciling import throws', async () => {
        const legacy = buildAccount({ address: 'FRESH', name: 'F' })
        vi.mocked(migrateLegacyAccount).mockRejectedValueOnce(new Error('boom'))

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(addKeylessAccountToStore).not.toHaveBeenCalled()
        expect(result.failed).toHaveLength(1)
    })

    it('skips applyLegacyAccountOrder on an accounts-v2 re-run to preserve user reordering', async () => {
        vi.mocked(migrateLegacyAccount).mockResolvedValue({
            address: 'X',
        } as never)

        await runMigrationLoop({
            ...buildDeps(),
            accounts: [buildAccount({ address: 'A', preferredOrder: 0 })],
            hdWallets: [],
            isRerun: true,
        })

        expect(applyLegacyAccountOrder).not.toHaveBeenCalled()
    })

    it('backfills rekeyAddress on an existing watch account without reimporting', async () => {
        accountsStoreMock.accounts = [watchAccount('REKEYED')]
        const legacy = buildAccount({
            address: 'REKEYED',
            type: 'standard',
            secretKey: null,
            authAddress: 'AUTH',
        })

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(migrateLegacyAccount).not.toHaveBeenCalled()
        expect(result.skipped).toBe(1)
        expect(removeAccountFromStore).not.toHaveBeenCalled()
        expect(applyRekeyAddressToStoreAccount).toHaveBeenCalledWith(
            'REKEYED',
            'AUTH',
        )
    })

    it('still plain-skips existing non-watch accounts', async () => {
        accountsStoreMock.accounts = [algo25Account('KEEPME')]
        const legacy = buildAccount({ address: 'KEEPME', type: 'standard' })

        const result = await runMigrationLoop({
            ...buildDeps(),
            accounts: [legacy],
            hdWallets: [],
        })

        expect(result.skipped).toBe(1)
        expect(migrateLegacyAccount).not.toHaveBeenCalled()
        expect(removeAccountFromStore).not.toHaveBeenCalled()
        expect(applyRekeyAddressToStoreAccount).not.toHaveBeenCalled()
    })
})
