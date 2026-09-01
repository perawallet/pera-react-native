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
    algo25SecretKeyToIndices: vi.fn(() => new Uint16Array(25).fill(1)),
}))

import { AccountTypes } from '@perawallet/wallet-core-accounts'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import { migrateAlgo25Account } from '../migrateAlgo25Account'
import { algo25SecretKeyToIndices } from '../legacyKeyConversion'
import type { MigrateAccountArgs } from '../types'

const buildLegacyAccount = (
    overrides: Partial<LegacyAccount> = {},
): LegacyAccount =>
    ({
        address: 'ADDR_LEGACY',
        name: 'Legacy',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: new Uint8Array(32).fill(9),
        hdWalletId: null,
        ledger: null,
        joint: null,
        authAddress: null,
        ...overrides,
    }) as LegacyAccount

const buildArgs = (
    overrides: Partial<MigrateAccountArgs> = {},
): MigrateAccountArgs =>
    ({
        account: buildLegacyAccount(),
        hdWalletsById: new Map(),
        importedHdRoots: new Map(),
        importAccount: vi.fn().mockResolvedValue({
            id: 'imported-id',
            type: AccountTypes.algo25,
            address: 'ADDR_LEGACY',
            keyPairId: 'kp',
        }),
        createHdWalletAccount:
            vi.fn() as unknown as MigrateAccountArgs['createHdWalletAccount'],
        createHDWalletKey:
            vi.fn() as unknown as MigrateAccountArgs['createHDWalletKey'],
        hasSeedWithEntropy:
            vi.fn() as unknown as MigrateAccountArgs['hasSeedWithEntropy'],
        ...overrides,
    }) as MigrateAccountArgs

beforeEach(() => {
    vi.mocked(algo25SecretKeyToIndices).mockClear()
    vi.mocked(algo25SecretKeyToIndices).mockReturnValue(
        new Uint16Array(25).fill(1),
    )
})

describe('migrateAlgo25Account', () => {
    it('throws when the legacy account has no secretKey', async () => {
        const args = buildArgs({
            account: buildLegacyAccount({ secretKey: null }),
        })

        await expect(migrateAlgo25Account(args)).rejects.toThrow(
            'Algo25 account is missing secretKey',
        )
    })

    it('imports with the derived indices and algo25 type', async () => {
        const importAccount = vi.fn().mockResolvedValue({
            id: 'i',
            type: AccountTypes.algo25,
            address: 'ADDR_LEGACY',
            keyPairId: 'kp',
        })
        const args = buildArgs({ importAccount })

        await migrateAlgo25Account(args)

        expect(algo25SecretKeyToIndices).toHaveBeenCalledWith(
            args.account.secretKey,
        )
        expect(importAccount).toHaveBeenCalledWith({
            mnemonicIndices: expect.objectContaining({ length: 25 }),
            type: 'algo25',
        })
    })

    it('returns the created account when the imported address matches', async () => {
        const created = {
            id: 'created',
            type: AccountTypes.algo25,
            address: 'ADDR_LEGACY',
            keyPairId: 'kp',
        }
        const args = buildArgs({
            importAccount: vi.fn().mockResolvedValue(created),
        })

        const result = await migrateAlgo25Account(args)

        expect(result).toBe(created)
    })

    it('throws when the imported address does not match the legacy address', async () => {
        const args = buildArgs({
            account: buildLegacyAccount({ address: 'ADDR_LEGACY' }),
            importAccount: vi.fn().mockResolvedValue({
                id: 'mismatch',
                type: AccountTypes.algo25,
                address: 'ADDR_DIFFERENT',
                keyPairId: 'kp',
            }),
        })

        await expect(migrateAlgo25Account(args)).rejects.toThrow(
            'Imported algo25 address ADDR_DIFFERENT did not match legacy address ADDR_LEGACY',
        )
    })

    it('wipes the decrypted secretKey after a successful import', async () => {
        const secretKey = new Uint8Array(32).fill(9)
        const args = buildArgs({
            account: buildLegacyAccount({ secretKey }),
        })

        await migrateAlgo25Account(args)

        expect(secretKey.every(b => b === 0)).toBe(true)
    })

    it('wipes the decrypted secretKey even when the import fails', async () => {
        const secretKey = new Uint8Array(32).fill(9)
        const args = buildArgs({
            account: buildLegacyAccount({ secretKey }),
            importAccount: vi.fn().mockResolvedValue({
                id: 'mismatch',
                type: AccountTypes.algo25,
                address: 'ADDR_DIFFERENT',
                keyPairId: 'kp',
            }),
        })

        await expect(migrateAlgo25Account(args)).rejects.toThrow()

        expect(secretKey.every(b => b === 0)).toBe(true)
    })
})
