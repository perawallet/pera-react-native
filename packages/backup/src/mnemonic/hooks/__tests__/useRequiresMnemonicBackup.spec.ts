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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    createFakeKeystore,
    fakeChildKey,
    fakeSeedKey,
} from '../../../__tests__/fakeKeystore'

const keystore = createFakeKeystore()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
        },
        chains: {
            has: () => true,
            get: () => ({
                descriptor: { signing: { standaloneSecret: 'mnemonic' } },
            }),
        },
    }),
    getKeystoreStore: () => keystore.store,
}))

const localAccount = (
    id: string,
    keyPairId: string,
    custody: WalletAccount['custody'],
): WalletAccount => ({
    id,
    custody,
    chains: { algorand: { address: `ADDR-${id}`, keyPairId } },
})

const algo25 = (id: string, keyPairId: string) =>
    localAccount(id, keyPairId, { kind: 'local', seed: null })

const quantum = (id: string, keyPairId: string) =>
    localAccount(id, keyPairId, { kind: 'local', seed: 'quantum' })

const hd = (id: string, keyPairId: string, keyIndex: number) =>
    localAccount(id, keyPairId, {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex },
    })

describe('useRequiresMnemonicBackup', () => {
    beforeEach(async () => {
        vi.resetModules()
        keystore.setKeys([
            fakeSeedKey('seed-a'),
            fakeChildKey('a-child-0', 'seed-a'),
            fakeChildKey('a-child-1', 'seed-a'),
            fakeSeedKey('seed-b'),
            fakeChildKey('b-child-0', 'seed-b'),
            fakeSeedKey('seed-q'),
            fakeChildKey('q-child', 'seed-q'),
            fakeChildKey('raw-key'),
        ])
        const { registerFakeBackupAdapter } =
            await import('../../../__tests__/fakeBackupAdapter')
        registerFakeBackupAdapter()
    })

    const render = async (account: WalletAccount | null) => {
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')
        return renderHook(() => useRequiresMnemonicBackup(account, 'algorand'))
    }

    const mark = async (id: string) => {
        const { useMnemonicBackupStore } = await import('../../store')
        act(() => {
            useMnemonicBackupStore.getState().markBackedUp(id)
        })
    }

    test('requires a backup for every kind of account with a seed that is not marked', async () => {
        expect((await render(algo25('algo', 'a-child-0'))).result.current).toBe(
            true,
        )
        expect((await render(quantum('q', 'q-child'))).result.current).toBe(
            true,
        )
        expect((await render(hd('hd-0', 'a-child-0', 0))).result.current).toBe(
            true,
        )
    })

    test('requires nothing of an HD account whose seed is marked, nor of its siblings', async () => {
        await mark('seed-a')

        expect((await render(hd('hd-0', 'a-child-0', 0))).result.current).toBe(
            false,
        )
        expect((await render(hd('hd-1', 'a-child-1', 1))).result.current).toBe(
            false,
        )
    })

    test('counts a mark saved under a sibling child key towards the whole seed', async () => {
        await mark('a-child-0')

        expect((await render(hd('hd-1', 'a-child-1', 1))).result.current).toBe(
            false,
        )
    })

    test('counts a mark saved under an algo25 child key', async () => {
        await mark('a-child-0')

        expect((await render(algo25('algo', 'a-child-0'))).result.current).toBe(
            false,
        )
    })

    test('leaves another seed requiring a backup when one seed is marked', async () => {
        await mark('seed-a')

        expect(
            (await render(algo25('algo-b', 'b-child-0'))).result.current,
        ).toBe(true)
    })

    test('requires nothing of a quantum account once its seed is marked', async () => {
        await mark('seed-q')

        expect((await render(quantum('q', 'q-child'))).result.current).toBe(
            false,
        )
    })

    test('keeps counting a mark saved under a child key after that key is removed', async () => {
        await mark('a-child-0')
        const { result } = await render(hd('hd-1', 'a-child-1', 1))
        expect(result.current).toBe(false)

        act(() => {
            keystore.setKeys([
                fakeSeedKey('seed-a'),
                fakeChildKey('a-child-1', 'seed-a'),
            ])
        })

        expect(result.current).toBe(false)
        const { useMnemonicBackupStore } = await import('../../store')
        expect(useMnemonicBackupStore.getState().backedUpKeyIds).toEqual({
            'seed-a': true,
        })
    })

    test('requires nothing of a local account whose key has no seed', async () => {
        expect((await render(algo25('raw', 'raw-key'))).result.current).toBe(
            false,
        )
    })

    test('does not count a marked child key that is no longer in the keystore', async () => {
        await mark('gone-child')

        expect((await render(hd('hd-0', 'a-child-0', 0))).result.current).toBe(
            true,
        )
    })

    test('turns true once the keystore loads the account seed', async () => {
        keystore.setKeys([])
        const { result } = await render(hd('hd-0', 'a-child-0', 0))
        expect(result.current).toBe(false)

        act(() => {
            keystore.setKeys([
                fakeSeedKey('seed-a'),
                fakeChildKey('a-child-0', 'seed-a'),
            ])
        })

        expect(result.current).toBe(true)
    })

    test('requires nothing of accounts without a backup concept (watch)', async () => {
        const account: WalletAccount = {
            id: 'account-4',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR' } },
        }

        expect((await render(account)).result.current).toBe(false)
    })

    test('returns false when account is null/undefined', async () => {
        expect((await render(null)).result.current).toBe(false)
    })

    test('returns false for an account on a chain with no backup adapter', async () => {
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')
        const account: WalletAccount = {
            id: 'account-evm',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            chains: { ethereum: { address: '0xE1', keyPairId: 'a-child-0' } },
        }

        const { result } = renderHook(() =>
            useRequiresMnemonicBackup(account, 'ethereum'),
        )
        expect(result.current).toBe(false)
    })
})
