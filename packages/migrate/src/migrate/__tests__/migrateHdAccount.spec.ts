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

vi.mock('../legacyKeyConversion', () => ({
    hdWalletEntropyToIndices: vi.fn(() => new Uint16Array(24).fill(1)),
}))

import { AccountTypes } from '@perawallet/wallet-core-accounts'
import type {
    LegacyAccount,
    LegacyHDKey,
    LegacyHDWallet,
} from '@perawallet/wallet-extension-platform'
import { migrateHdAccount } from '../migrateHdAccount'
import { hdWalletEntropyToIndices } from '../legacyKeyConversion'
import type { ImportedHdRoot, MigrateAccountArgs } from '../types'

const buildKey = (overrides: Partial<LegacyHDKey> = {}): LegacyHDKey => ({
    address: 'ADDR_CHILD',
    account: 0,
    change: 0,
    keyIndex: 0,
    derivationType: 32,
    privateKey: null,
    ...overrides,
})

const buildWallet = (
    overrides: Partial<LegacyHDWallet> = {},
): LegacyHDWallet => ({
    walletId: 'wallet-1',
    name: null,
    entropy: new Uint8Array(32).fill(1),
    keys: [buildKey()],
    ...overrides,
})

const buildAccount = (overrides: Partial<LegacyAccount> = {}): LegacyAccount =>
    ({
        address: 'ADDR_CHILD',
        name: 'HD',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: null,
        hdWalletId: 'wallet-1',
        ledger: null,
        joint: null,
        authAddress: null,
        ...overrides,
    }) as LegacyAccount

const buildArgs = (
    overrides: Partial<MigrateAccountArgs> = {},
): MigrateAccountArgs => {
    const account = overrides.account ?? buildAccount()
    const childKey = buildKey({
        address: account.address,
        account: 3,
        keyIndex: 7,
    })
    const parent = buildWallet({
        walletId: account.hdWalletId ?? 'wallet-1',
        keys: [childKey],
    })
    return {
        account,
        hdWalletsById:
            overrides.hdWalletsById ?? new Map([[parent.walletId, parent]]),
        importedHdRoots: overrides.importedHdRoots ?? new Map(),
        importAccount:
            vi.fn() as unknown as MigrateAccountArgs['importAccount'],
        createHdWalletAccount:
            overrides.createHdWalletAccount ??
            (vi.fn().mockResolvedValue({
                id: 'created-id',
                type: AccountTypes.hdWallet,
                address: account.address,
                keyPairId: 'kp',
                hdWalletDetails: {} as never,
            }) as unknown as MigrateAccountArgs['createHdWalletAccount']),
        createHDWalletKey:
            overrides.createHDWalletKey ??
            (vi.fn().mockResolvedValue({
                seedKey: { id: 'root-key-pair-id' },
            }) as unknown as MigrateAccountArgs['createHDWalletKey']),
        hasSeedWithEntropy:
            overrides.hasSeedWithEntropy ??
            (vi.fn(
                () => false,
            ) as unknown as MigrateAccountArgs['hasSeedWithEntropy']),
    } as MigrateAccountArgs
}

beforeEach(() => {
    vi.mocked(hdWalletEntropyToIndices).mockClear()
    vi.mocked(hdWalletEntropyToIndices).mockReturnValue(
        new Uint16Array(24).fill(1),
    )
})

describe('migrateHdAccount', () => {
    it('throws when the legacy account has no hdWalletId', async () => {
        const args = buildArgs({ account: buildAccount({ hdWalletId: null }) })

        await expect(migrateHdAccount(args)).rejects.toThrow(
            'HD account missing hdWalletId',
        )
    })

    it('throws when the HD parent wallet is missing from the payload', async () => {
        const args = buildArgs({
            account: buildAccount({ hdWalletId: 'missing' }),
            hdWalletsById: new Map(),
        })

        await expect(migrateHdAccount(args)).rejects.toThrow(
            'HD parent wallet missing not found in payload',
        )
    })

    it('throws when the HD parent has no key entry for the address', async () => {
        const orphan = buildWallet({
            walletId: 'wallet-orphan',
            keys: [buildKey({ address: 'OTHER_ADDR' })],
        })
        const args = buildArgs({
            account: buildAccount({
                address: 'ADDR_MISSING',
                hdWalletId: 'wallet-orphan',
            }),
            hdWalletsById: new Map([[orphan.walletId, orphan]]),
        })

        await expect(migrateHdAccount(args)).rejects.toThrow(
            'HD parent wallet-orphan has no key entry for ADDR_MISSING',
        )
    })

    it('wipes the decrypted seed entropy after importing the HD root', async () => {
        const args = buildArgs()
        const parent = args.hdWalletsById.get('wallet-1')
        expect(parent?.entropy?.every(b => b === 1)).toBe(true)

        await migrateHdAccount(args)

        expect(parent?.entropy?.every(b => b === 0)).toBe(true)
    })

    it('leaves the shared seed entropy intact when the HD root import fails', async () => {
        const createHDWalletKey = vi
            .fn()
            .mockRejectedValue(new Error('transient keystore error'))
        const args = buildArgs({
            createHDWalletKey:
                createHDWalletKey as unknown as MigrateAccountArgs['createHDWalletKey'],
        })
        const parent = args.hdWalletsById.get('wallet-1')

        await expect(migrateHdAccount(args)).rejects.toThrow(
            'transient keystore error',
        )

        expect(parent?.entropy?.every(b => b === 1)).toBe(true)
    })

    it('imports the HD root on first encounter and caches it for reuse', async () => {
        const createHDWalletKey = vi.fn().mockResolvedValue({
            seedKey: { id: 'kp-id' },
        })
        const importedHdRoots = new Map<string, ImportedHdRoot>()
        const args = buildArgs({
            createHDWalletKey:
                createHDWalletKey as unknown as MigrateAccountArgs['createHDWalletKey'],
            importedHdRoots,
        })

        await migrateHdAccount(args)

        expect(hdWalletEntropyToIndices).toHaveBeenCalledTimes(1)
        expect(createHDWalletKey).toHaveBeenCalledTimes(1)
        expect(createHDWalletKey).toHaveBeenCalledWith({
            id: 'wallet-1',
            mnemonicIndices: expect.objectContaining({ length: 24 }),
        })
        expect(importedHdRoots.get('wallet-1')).toEqual({
            seedKeyId: 'kp-id',
        })
    })

    it('reuses an already-imported seed (root + entropy) without re-importing across runs', async () => {
        const createHDWalletKey = vi.fn()
        const hasSeedWithEntropy = vi.fn(() => true) as unknown as never
        const createHdWalletAccount = vi.fn().mockResolvedValue({
            id: 'c',
            type: AccountTypes.hdWallet,
            address: 'ADDR_CHILD',
            keyPairId: 'kp',
            hdWalletDetails: {} as never,
        })
        const args = buildArgs({
            hasSeedWithEntropy,
            createHDWalletKey:
                createHDWalletKey as unknown as MigrateAccountArgs['createHDWalletKey'],
            createHdWalletAccount:
                createHdWalletAccount as unknown as MigrateAccountArgs['createHdWalletAccount'],
        })

        await migrateHdAccount(args)

        expect(createHDWalletKey).not.toHaveBeenCalled()
        expect(hdWalletEntropyToIndices).not.toHaveBeenCalled()
        expect(createHdWalletAccount).toHaveBeenCalledWith({
            seedKeyId: 'wallet-1',
            account: 3,
            keyIndex: 7,
        })
    })

    it('re-imports (self-heals) when a prior seed root exists but its entropy child is missing', async () => {
        const createHDWalletKey = vi.fn().mockResolvedValue({
            seedKey: { id: 'wallet-1' },
        })
        const hasSeedWithEntropy = vi.fn(() => false) as unknown as never
        const args = buildArgs({
            hasSeedWithEntropy,
            createHDWalletKey:
                createHDWalletKey as unknown as MigrateAccountArgs['createHDWalletKey'],
        })

        await migrateHdAccount(args)

        expect(createHDWalletKey).toHaveBeenCalledWith({
            id: 'wallet-1',
            mnemonicIndices: expect.objectContaining({ length: 24 }),
        })
    })

    it('reuses the cached HD root without re-deriving the indices', async () => {
        const createHDWalletKey = vi.fn()
        const importedHdRoots = new Map<string, ImportedHdRoot>([
            ['wallet-1', { seedKeyId: 'cached-id' }],
        ])
        const args = buildArgs({
            createHDWalletKey:
                createHDWalletKey as unknown as MigrateAccountArgs['createHDWalletKey'],
            importedHdRoots,
        })

        await migrateHdAccount(args)

        expect(hdWalletEntropyToIndices).not.toHaveBeenCalled()
        expect(createHDWalletKey).not.toHaveBeenCalled()
    })

    it('passes seedKeyId and child indices to createHdWalletAccount', async () => {
        const createHdWalletAccount = vi.fn().mockResolvedValue({
            id: 'c',
            type: AccountTypes.hdWallet,
            address: 'ADDR_CHILD',
            keyPairId: 'kp',
            hdWalletDetails: {} as never,
        })
        const importedHdRoots = new Map<string, ImportedHdRoot>([
            ['wallet-1', { seedKeyId: 'cached-root' }],
        ])
        const args = buildArgs({
            createHdWalletAccount:
                createHdWalletAccount as unknown as MigrateAccountArgs['createHdWalletAccount'],
            importedHdRoots,
        })

        await migrateHdAccount(args)

        expect(createHdWalletAccount).toHaveBeenCalledWith({
            seedKeyId: 'cached-root',
            account: 3,
            keyIndex: 7,
        })
    })

    it('falls back to the walletId when createHDWalletKey returns no seedKey.id', async () => {
        const createHDWalletKey = vi.fn().mockResolvedValue({ seedKey: {} })
        const importedHdRoots = new Map<string, ImportedHdRoot>()
        const args = buildArgs({
            createHDWalletKey:
                createHDWalletKey as unknown as MigrateAccountArgs['createHDWalletKey'],
            importedHdRoots,
        })

        await migrateHdAccount(args)

        expect(importedHdRoots.get('wallet-1')?.seedKeyId).toBe('wallet-1')
    })

    it('throws when the derived address does not match the legacy address', async () => {
        const createHdWalletAccount = vi.fn().mockResolvedValue({
            id: 'm',
            type: AccountTypes.hdWallet,
            address: 'ADDR_MISMATCH',
            keyPairId: 'kp',
            hdWalletDetails: {} as never,
        })
        const args = buildArgs({
            createHdWalletAccount:
                createHdWalletAccount as unknown as MigrateAccountArgs['createHdWalletAccount'],
        })

        await expect(migrateHdAccount(args)).rejects.toThrow(
            'Derived address ADDR_MISMATCH did not match legacy address ADDR_CHILD',
        )
    })
})
