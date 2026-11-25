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
import type { WalletAccount } from '../../models'

const state = vi.hoisted(() => ({
    provisional: [] as string[],
    keys: [] as {
        id: string
        type?: string
        metadata?: { parentKeyId: string }
    }[],
    accounts: [] as WalletAccount[],
    hydrated: true,
    pending: null as { walletKeyId: string } | null,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    readProvisionalSeeds: () => [...state.provisional],
    provisionalSeedLockName: (id: string) => `kms-provisional-seeds:${id}`,
    clearProvisionalSeed: (id: string) => {
        state.provisional = state.provisional.filter(seed => seed !== id)
    },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystore: () => ({ ready: Promise.resolve() }),
    getKeystoreStore: () => ({ state: { keys: state.keys } }),
    isPasskeyCredentialType: (type: unknown) => type === 'hd-derived-p256',
}))

vi.mock('../../store', () => ({
    useAccountsStore: {
        getState: () => ({ accounts: state.accounts }),
        persist: { hasHydrated: () => state.hydrated },
    },
}))

vi.mock('../store', () => ({
    useHDImportSessionStore: { getState: () => ({ pending: state.pending }) },
}))

import { sweepAbandonedImportSeeds } from '../sweepAbandonedImportSeeds'
import { getPasskeyAnchorSeedIds } from '../provisionalImportSeeds'

const hdAccount = (id: string, keyPairId: string): WalletAccount =>
    ({
        id,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chains: { algorand: { address: id, keyPairId } },
    }) as WalletAccount

const heldKeys = () => [
    { id: 'kept' },
    { id: 'kept/child', metadata: { parentKeyId: 'kept' } },
]

describe('sweepAbandonedImportSeeds', () => {
    const remove = vi.fn(async (_seedId: string) => {})

    beforeEach(() => {
        remove.mockClear()
        state.provisional = []
        state.keys = []
        state.accounts = []
        state.hydrated = true
        state.pending = null
    })

    it('preserves roots needed by existing credentials without authorizing a new anchor', async () => {
        state.provisional = ['seed']
        state.keys = [
            { id: 'seed' },
            { id: 'main', metadata: { parentKeyId: 'seed' } },
            {
                id: 'credential',
                type: 'hd-derived-p256',
                metadata: { parentKeyId: 'main' },
            },
        ]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).not.toHaveBeenCalled()
        expect(state.provisional).toEqual([])
        expect(
            getPasskeyAnchorSeedIds(
                state.keys as Parameters<typeof getPasskeyAnchorSeedIds>[0],
            ).has('seed'),
        ).toBe(false)
    })

    it('removes the seed of an import the app was killed in, on the next launch', async () => {
        state.provisional = ['abandoned']
        state.keys = [{ id: 'abandoned' }, ...heldKeys()]
        state.accounts = [hdAccount('acc-1', 'kept/child')]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).toHaveBeenCalledExactlyOnceWith('abandoned')
        expect(state.provisional).toEqual([])
    })

    it('leaves a seed another extension context is still importing', async () => {
        state.provisional = ['in-flight']
        state.keys = [{ id: 'in-flight' }]
        let release!: () => void
        let granted!: () => void
        const held = new Promise<void>(resolve => (granted = resolve))
        void navigator.locks.request(
            'kms-provisional-seeds:in-flight',
            () =>
                new Promise<void>(resolve => {
                    release = resolve
                    granted()
                }),
        )
        await held

        await sweepAbandonedImportSeeds(remove)
        release()

        expect(remove).not.toHaveBeenCalled()
        expect(state.provisional).toEqual(['in-flight'])
    })

    it('never removes a seed a stored account uses', async () => {
        state.provisional = ['kept']
        state.keys = heldKeys()
        state.accounts = [hdAccount('acc-1', 'kept/child')]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).not.toHaveBeenCalled()
        expect(state.provisional).toEqual([])
    })

    it('cleans the abandoned seed when an unrelated account key is missing', async () => {
        state.provisional = ['abandoned']
        state.keys = [{ id: 'abandoned' }]
        state.accounts = [hdAccount('acc-1', 'missing-child')]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).toHaveBeenCalledExactlyOnceWith('abandoned')
        expect(state.provisional).toEqual([])
    })

    it('keeps processing accounts when one stored record lacks chain entries', async () => {
        state.provisional = ['kept', 'abandoned']
        state.keys = [{ id: 'abandoned' }, ...heldKeys()]
        state.accounts = [
            { id: 'incomplete' } as WalletAccount,
            hdAccount('acc-1', 'kept/child'),
        ]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).toHaveBeenCalledExactlyOnceWith('abandoned')
        expect(
            getPasskeyAnchorSeedIds(
                state.keys as Parameters<typeof getPasskeyAnchorSeedIds>[0],
            ).has('kept'),
        ).toBe(true)
    })

    it('protects a seed referenced on another chain when the first key is missing', async () => {
        state.provisional = ['kept', 'abandoned']
        state.keys = [{ id: 'abandoned' }, ...heldKeys()]
        const account = hdAccount('acc-1', 'missing-child')
        state.accounts = [
            {
                ...account,
                chains: {
                    ...account.chains,
                    ethereum: { address: '0x1', keyPairId: 'kept/child' },
                },
            },
        ]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).toHaveBeenCalledExactlyOnceWith('abandoned')
        expect(state.provisional).toEqual([])
    })

    it('keeps a legacy direct seed reference and never sweeps unmarked roots', async () => {
        state.provisional = ['kept']
        state.keys = [{ id: 'older-unmarked' }, { id: 'kept' }]
        state.accounts = [hdAccount('legacy', 'kept')]

        await sweepAbandonedImportSeeds(remove)

        expect(remove).not.toHaveBeenCalled()
        expect(state.provisional).toEqual([])
    })

    it('only makes stored account roots eligible to anchor a replacement passkey key', () => {
        state.keys = [{ id: 'older-unmarked' }, ...heldKeys()]
        state.accounts = [hdAccount('acc-1', 'kept/child')]

        const keys = state.keys as Parameters<typeof getPasskeyAnchorSeedIds>[0]
        expect(getPasskeyAnchorSeedIds(keys).has('kept')).toBe(true)
        expect(getPasskeyAnchorSeedIds(keys).has('older-unmarked')).toBe(false)
    })

    it.each([
        ['Algo25', { kind: 'local', seed: null }],
        ['quantum', { kind: 'local', seed: 'quantum' }],
    ])(
        'lets an %s-only wallet anchor passkey registration on its seed',
        (_label, custody) => {
            state.keys = [
                { id: 'wallet-seed' },
                {
                    id: 'wallet-seed/sign',
                    metadata: { parentKeyId: 'wallet-seed' },
                },
            ]
            state.accounts = [
                {
                    id: 'acc-1',
                    custody,
                    chains: {
                        algorand: {
                            address: 'acc-1',
                            keyPairId: 'wallet-seed/sign',
                        },
                    },
                } as WalletAccount,
            ]

            const keys = state.keys as Parameters<
                typeof getPasskeyAnchorSeedIds
            >[0]
            expect(getPasskeyAnchorSeedIds(keys).has('wallet-seed')).toBe(true)
        },
    )

    it('never anchors on a key a non-local account references', () => {
        state.keys = [{ id: 'device-key' }]
        state.accounts = [
            {
                id: 'acc-1',
                custody: { kind: 'watch' },
                chains: {
                    algorand: { address: 'acc-1', keyPairId: 'device-key' },
                },
            } as WalletAccount,
        ]

        const keys = state.keys as Parameters<typeof getPasskeyAnchorSeedIds>[0]
        expect(getPasskeyAnchorSeedIds(keys).size).toBe(0)
    })

    it('waits for the accounts to load before judging any seed', async () => {
        state.provisional = ['abandoned']
        state.keys = [{ id: 'abandoned' }]
        state.hydrated = false

        await sweepAbandonedImportSeeds(remove)

        expect(remove).not.toHaveBeenCalled()
        expect(state.provisional).toEqual(['abandoned'])
    })

    it('leaves the seed of an import still in progress', async () => {
        state.provisional = ['in-progress']
        state.keys = [{ id: 'in-progress' }]
        state.pending = { walletKeyId: 'in-progress' }

        await sweepAbandonedImportSeeds(remove)

        expect(remove).not.toHaveBeenCalled()
        expect(state.provisional).toEqual(['in-progress'])
    })

    it('keeps the mark when the removal fails, so the next launch retries', async () => {
        state.provisional = ['abandoned']
        state.keys = [{ id: 'abandoned' }]
        remove.mockRejectedValueOnce(new Error('keystore busy'))

        await sweepAbandonedImportSeeds(remove)

        expect(state.provisional).toEqual(['abandoned'])
    })
})
