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
const mockWarn = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        logger: { ...original.logger, warn: mockWarn },
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

describe('useMarkMnemonicBackupComplete', () => {
    beforeEach(() => {
        vi.resetModules()
        mockWarn.mockClear()
        keystore.setKeys([
            fakeSeedKey('seed-a'),
            fakeChildKey('a-child-0', 'seed-a'),
            fakeChildKey('a-child-1', 'seed-a'),
            fakeSeedKey('seed-b'),
            fakeChildKey('b-child-0', 'seed-b'),
            fakeChildKey('raw-key'),
        ])
    })

    const markAll = async (accounts: WalletAccount[]) => {
        const { useMnemonicBackupStore } = await import('../../store')
        const { useMarkMnemonicBackupComplete } =
            await import('../useMarkMnemonicBackupComplete')
        const { result } = renderHook(() => useMarkMnemonicBackupComplete())
        act(() => {
            accounts.forEach(account => result.current(account))
        })
        return useMnemonicBackupStore.getState().backedUpKeyIds
    }

    test('marks the seed, not the signing child, of an algo25 account', async () => {
        const marked = await markAll([
            localAccount('algo', 'b-child-0', { kind: 'local', seed: null }),
        ])

        expect(marked).toEqual({ 'seed-b': true })
    })

    test('marks the one seed shared by every HD sibling', async () => {
        const hd = (id: string, keyPairId: string, keyIndex: number) =>
            localAccount(id, keyPairId, {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex },
            })

        const marked = await markAll([
            hd('hd-0', 'a-child-0', 0),
            hd('hd-1', 'a-child-1', 1),
        ])

        expect(marked).toEqual({ 'seed-a': true })
    })

    test.each([
        ['watch', { kind: 'watch' }],
        ['multisig', { kind: 'multisig' }],
    ] as const)('records nothing for a %s account', async (_, custody) => {
        const account: WalletAccount = {
            id: 'no-seed',
            custody,
            chains: { algorand: { address: 'ADDR' } },
        }

        expect(await markAll([account])).toEqual({})
    })

    test('records nothing, and warns, for a local account whose key resolves no seed', async () => {
        const marked = await markAll([
            localAccount('raw', 'raw-key', { kind: 'local', seed: null }),
        ])

        expect(marked).toEqual({})
        expect(mockWarn).toHaveBeenCalledTimes(1)
    })

    test('does not warn for accounts that never have a seed', async () => {
        await markAll([
            {
                id: 'watch',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'ADDR' } },
            },
        ])

        expect(mockWarn).not.toHaveBeenCalled()
    })
})
