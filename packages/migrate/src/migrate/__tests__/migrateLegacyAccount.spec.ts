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

// Same stub as buildKeylessAccount.spec.ts. Without it, the importActual of
// buildKeylessAccount below loads the real blockchain package (algosdk), which
// under CI's coverage instrumentation takes ~5s — right at the test timeout.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    generateMultisigAddress: vi.fn(
        (version: number, threshold: number, addresses: string[]) =>
            `MSIG:v${version}:t${threshold}:${addresses.join(',')}`,
    ),
    // The accounts barrel installs a network-switch subscription at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
}))

vi.mock('../accountStoreOps', () => ({
    addKeylessAccountToStore: vi.fn(account => account),
}))

vi.mock('../buildKeylessAccount', () => ({
    buildWatchAccount: vi.fn(() => ({ kind: 'watch-built' })),
    buildLedgerAccount: vi.fn(() => ({ kind: 'ledger-built' })),
    buildMultiSigAccount: vi.fn(() => ({ kind: 'msig-built' })),
}))

vi.mock('../legacyKeyConversion', () => ({
    describeBytes: vi.fn(() => 'null'),
}))

vi.mock('../migrateAlgo25Account', () => ({
    migrateAlgo25Account: vi.fn(async () => ({ kind: 'algo25-imported' })),
}))

vi.mock('../migrateHdAccount', () => ({
    migrateHdAccount: vi.fn(async () => ({ kind: 'hd-imported' })),
}))

import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import {
    migrateLegacyAccount,
    isKeylessLegacyAccount,
    classifyLegacyAccountRoute,
} from '../migrateLegacyAccount'
import { addKeylessAccountToStore } from '../accountStoreOps'
import {
    buildLedgerAccount,
    buildMultiSigAccount,
    buildWatchAccount,
} from '../buildKeylessAccount'
import { migrateAlgo25Account } from '../migrateAlgo25Account'
import { migrateHdAccount } from '../migrateHdAccount'
import type { MigrateAccountArgs } from '../types'

const buildAccount = (overrides: Partial<LegacyAccount> = {}): LegacyAccount =>
    ({
        address: 'ADDR',
        name: '',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: null,
        hdWalletId: null,
        ledger: null,
        joint: null,
        authAddress: null,
        ...overrides,
    }) as LegacyAccount

const buildArgs = (account: LegacyAccount): MigrateAccountArgs =>
    ({
        account,
        hdWalletsById: new Map(),
        importedHdRoots: new Map(),
        importAccount:
            vi.fn() as unknown as MigrateAccountArgs['importAccount'],
        createHdWalletAccount:
            vi.fn() as unknown as MigrateAccountArgs['createHdWalletAccount'],
        createHDWalletKey:
            vi.fn() as unknown as MigrateAccountArgs['createHDWalletKey'],
        hasSeedWithEntropy:
            vi.fn() as unknown as MigrateAccountArgs['hasSeedWithEntropy'],
    }) as MigrateAccountArgs

beforeEach(() => {
    vi.mocked(addKeylessAccountToStore).mockClear()
    vi.mocked(buildWatchAccount).mockClear()
    vi.mocked(buildLedgerAccount).mockClear()
    vi.mocked(buildMultiSigAccount).mockClear()
    vi.mocked(migrateAlgo25Account).mockClear()
    vi.mocked(migrateHdAccount).mockClear()
})

describe('migrateLegacyAccount dispatch', () => {
    it('routes watch accounts through buildWatchAccount + store add', async () => {
        const account = buildAccount({ type: 'watch' })

        await migrateLegacyAccount(buildArgs(account))

        expect(buildWatchAccount).toHaveBeenCalledWith(account)
        expect(addKeylessAccountToStore).toHaveBeenCalledWith({
            kind: 'watch-built',
        })
        expect(migrateAlgo25Account).not.toHaveBeenCalled()
        expect(migrateHdAccount).not.toHaveBeenCalled()
    })

    it('routes multisig (joint != null) before checking ledger/hd/secret', async () => {
        const account = buildAccount({
            joint: {
                threshold: 2,
                version: 1,
                participants: ['P1', 'P2'],
            },
            ledger: null,
            hdWalletId: 'should-be-ignored',
            secretKey: new Uint8Array(32).fill(1),
        })

        await migrateLegacyAccount(buildArgs(account))

        expect(buildMultiSigAccount).toHaveBeenCalledWith(account)
        expect(addKeylessAccountToStore).toHaveBeenCalled()
        expect(buildLedgerAccount).not.toHaveBeenCalled()
        expect(migrateHdAccount).not.toHaveBeenCalled()
        expect(migrateAlgo25Account).not.toHaveBeenCalled()
    })

    it('routes ledger before hd/algo25 when ledger details exist', async () => {
        const account = buildAccount({
            ledger: {
                bluetoothAddress: 'BT',
                bluetoothName: null,
                positionInLedger: 0,
            },
            hdWalletId: 'should-be-ignored',
        })

        await migrateLegacyAccount(buildArgs(account))

        expect(buildLedgerAccount).toHaveBeenCalledWith(account)
        expect(addKeylessAccountToStore).toHaveBeenCalled()
        expect(migrateHdAccount).not.toHaveBeenCalled()
        expect(migrateAlgo25Account).not.toHaveBeenCalled()
    })

    it('routes hd accounts when hdWalletId is set and no keyless flags', async () => {
        const account = buildAccount({ hdWalletId: 'wallet-x' })

        const result = await migrateLegacyAccount(buildArgs(account))

        expect(migrateHdAccount).toHaveBeenCalled()
        expect(result).toEqual({ kind: 'hd-imported' })
        expect(migrateAlgo25Account).not.toHaveBeenCalled()
    })

    it('routes algo25 when only a non-empty secretKey is present', async () => {
        const account = buildAccount({
            secretKey: new Uint8Array(32).fill(1),
        })

        const result = await migrateLegacyAccount(buildArgs(account))

        expect(migrateAlgo25Account).toHaveBeenCalled()
        expect(result).toEqual({ kind: 'algo25-imported' })
    })

    it('migrates an empty-secretKey account as a watch account instead of dropping it', async () => {
        const account = buildAccount({ secretKey: new Uint8Array(0) })

        await migrateLegacyAccount(buildArgs(account))

        expect(buildWatchAccount).toHaveBeenCalledWith(account)
        expect(addKeylessAccountToStore).toHaveBeenCalledWith({
            kind: 'watch-built',
        })
        expect(migrateAlgo25Account).not.toHaveBeenCalled()
    })

    it('migrates a no-signing-material account as a watch account when no branch matches', async () => {
        const account = buildAccount({ address: 'ADDR_BAD' })

        const result = await migrateLegacyAccount(buildArgs(account))

        expect(buildWatchAccount).toHaveBeenCalledWith(account)
        expect(result).toEqual({ kind: 'watch-built' })
    })
})

describe('isKeylessLegacyAccount', () => {
    it('returns true for watch accounts', () => {
        expect(isKeylessLegacyAccount(buildAccount({ type: 'watch' }))).toBe(
            true,
        )
    })

    it('returns true for joint accounts', () => {
        expect(
            isKeylessLegacyAccount(
                buildAccount({
                    joint: {
                        threshold: 1,
                        version: 1,
                        participants: ['P'],
                    },
                }),
            ),
        ).toBe(true)
    })

    it('returns true for ledger accounts', () => {
        expect(
            isKeylessLegacyAccount(
                buildAccount({
                    ledger: {
                        bluetoothAddress: 'BT',
                        bluetoothName: null,
                        positionInLedger: 0,
                    },
                }),
            ),
        ).toBe(true)
    })

    it('returns false for key-bearing accounts (hd, algo25)', () => {
        expect(isKeylessLegacyAccount(buildAccount({ hdWalletId: 'w' }))).toBe(
            false,
        )
        expect(
            isKeylessLegacyAccount(
                buildAccount({ secretKey: new Uint8Array(32) }),
            ),
        ).toBe(false)
    })
})

describe('classifyLegacyAccountRoute', () => {
    it('returns "watch" first', () => {
        expect(
            classifyLegacyAccountRoute(
                buildAccount({
                    type: 'watch',
                    joint: {
                        threshold: 1,
                        version: 1,
                        participants: ['P'],
                    },
                }),
            ),
        ).toBe('watch')
    })

    it('returns "joint" when not watch', () => {
        expect(
            classifyLegacyAccountRoute(
                buildAccount({
                    joint: {
                        threshold: 1,
                        version: 1,
                        participants: ['P'],
                    },
                    ledger: {
                        bluetoothAddress: 'BT',
                        bluetoothName: null,
                        positionInLedger: 0,
                    },
                }),
            ),
        ).toBe('joint')
    })

    it('returns "ledger" when only ledger details are present', () => {
        expect(
            classifyLegacyAccountRoute(
                buildAccount({
                    ledger: {
                        bluetoothAddress: 'BT',
                        bluetoothName: null,
                        positionInLedger: 0,
                    },
                    hdWalletId: 'w',
                }),
            ),
        ).toBe('ledger')
    })

    it('returns "hd" when only hdWalletId is set', () => {
        expect(
            classifyLegacyAccountRoute(buildAccount({ hdWalletId: 'w' })),
        ).toBe('hd')
    })

    it('returns "algo25" when only a non-empty secretKey is present', () => {
        expect(
            classifyLegacyAccountRoute(
                buildAccount({ secretKey: new Uint8Array(32).fill(1) }),
            ),
        ).toBe('algo25')
    })

    it('returns "unroutable" for empty secretKey', () => {
        expect(
            classifyLegacyAccountRoute(
                buildAccount({ secretKey: new Uint8Array(0) }),
            ),
        ).toBe('unroutable')
    })

    it('returns "unroutable" when nothing identifies the account', () => {
        expect(classifyLegacyAccountRoute(buildAccount())).toBe('unroutable')
    })
})

// Loaded at module scope: importActual pays the real module-chain load cost,
// which must land in the file's import phase, not inside a 5s test budget.
const { buildWatchAccount: realBuildWatchAccount } = await vi.importActual<
    typeof import('../buildKeylessAccount')
>('../buildKeylessAccount')

describe('migrateLegacyAccount with authAddress', () => {
    it('migrates a keyless account with authAddress as a rekeyed watch account', async () => {
        vi.mocked(buildWatchAccount).mockImplementationOnce(
            realBuildWatchAccount,
        )

        const account = buildAccount({
            type: 'standard',
            secretKey: null,
            hdWalletId: null,
            ledger: null,
            joint: null,
            authAddress: 'AUTHADDR',
        })

        const created = await migrateLegacyAccount(buildArgs(account))

        expect(created.type).toBe('watch')
        expect(created.rekeyAddress).toBe('AUTHADDR')
    })
})
