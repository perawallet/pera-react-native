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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../../chain-adapter'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    EVM_KEY_ADDRESS,
    EVM_KEY_ID,
    familyHdKeyId,
    POLYGON,
    registerChainFamilies,
    type ChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore } from '../store'

vi.mock('@perawallet/wallet-core-kms', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-kms')>()
    return {
        ...actual,
        kmsCore: {
            ...actual.kmsCore,
            getKey: vi.fn((id: string) =>
                id === 'raw-evm-key'
                    ? { id, publicKey: new Uint8Array(20).fill(0xe0) }
                    : null,
            ),
        },
    }
})

const hdAccount = () =>
    buildTestAccount(
        { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
        { [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'hd-key' } },
        { id: 'hd' },
    )

describe('discoverChains', () => {
    let families: ChainFamilies
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        families = registerChainFamilies()
        getKeystoreStore().state.keys = [
            { id: 'hd-seed', type: 'seed', metadata: { scheme: 'bip39' } },
            {
                id: 'hd-key',
                type: 'secp256k1',
                metadata: { parentKeyId: 'hd-seed' },
            },
        ] as never
        vi.mocked(getProvider().key.store.remove).mockClear()
        state().resetState()
    })

    test('enables exactly the eligible chains with activity, as discovered', async () => {
        families.active.add(BASE).add(POLYGON)
        state().setAccounts([
            buildTestAccount(
                TEST_CUSTODY.local,
                {
                    [ETHEREUM]: {
                        address: EVM_KEY_ADDRESS,
                        keyPairId: EVM_KEY_ID,
                    },
                },
                { id: 'key' },
            ),
        ])

        const enabled = await state().discoverChains('key')

        expect(enabled).toEqual([BASE, POLYGON])
        const { chains } = state().accounts[0]
        expect(Object.keys(chains).sort()).toEqual(
            [BASE, ETHEREUM, POLYGON].sort(),
        )
        expect(chains[BASE]).toMatchObject({
            address: EVM_KEY_ADDRESS,
            keyPairId: EVM_KEY_ID,
            enabledBy: 'discovery',
        })
        expect(families.checkActivity.get(ETHEREUM)).not.toHaveBeenCalled()
        expect(families.checkActivity.get(ALGORAND)).not.toHaveBeenCalled()
    })

    test("reads a probe that fails as inactive, keeping the other chains' answers", async () => {
        families.active.add(BASE).add(POLYGON)
        families.checkActivity
            .get(BASE)!
            .mockRejectedValueOnce(new Error('rpc down'))
        state().setAccounts([hdAccount()])

        await expect(state().discoverChains('hd')).resolves.toEqual([POLYGON])
        expect(state().accounts[0].chains[BASE]).toBeUndefined()
    })

    test('skips a chain with no accounts adapter', async () => {
        families.active.add(POLYGON)
        accountsChainAdapters.reset()
        state().setAccounts([hdAccount()])

        await expect(state().discoverChains('hd')).resolves.toEqual([])
    })

    test('never probes for a hardware account', async () => {
        families.active.add(ETHEREUM)
        state().setAccounts([
            buildTestAccount(
                TEST_CUSTODY.hardware,
                { [ALGORAND]: { address: ALGORAND_ADDRESS } },
                { id: 'ledger' },
            ),
        ])

        await expect(state().discoverChains('ledger')).resolves.toEqual([])
        for (const probe of families.checkActivity.values()) {
            expect(probe).not.toHaveBeenCalled()
        }
    })

    test('removes a key it derived only to probe a chain that turned out inactive', async () => {
        vi.mocked(
            families.derivations.get(POLYGON)!.deriveAccount,
        ).mockResolvedValueOnce({
            keyPairId: 'polygon-only-key',
            publicKey: new Uint8Array([1]),
            address: EVM_KEY_ADDRESS,
        })
        families.active.add(BASE)
        state().setAccounts([hdAccount()])

        await state().discoverChains('hd')

        expect(getProvider().key.store.remove).toHaveBeenCalledWith(
            'polygon-only-key',
        )
        expect(getProvider().key.store.remove).not.toHaveBeenCalledWith(
            familyHdKeyId('hd-seed', 'evm', 0, 0),
        )
    })

    test('probes only the families the account is already on', async () => {
        families.active.add(ALGORAND).add(BASE)
        state().setAccounts([hdAccount()])

        await expect(state().discoverChains('hd')).resolves.toEqual([BASE])
        expect(families.checkActivity.get(ALGORAND)).not.toHaveBeenCalled()
        expect(
            families.derivations.get(ALGORAND)?.deriveAccount,
        ).not.toHaveBeenCalled()
    })

    test('lets an enable on the same account wait for a probe in flight', async () => {
        let releaseProbe: () => void = () => {}
        families.checkActivity.get(BASE)!.mockImplementationOnce(
            (addresses: string[]) =>
                new Promise(resolve => {
                    releaseProbe = () =>
                        resolve(new Map(addresses.map(a => [a, false])))
                }),
        )
        state().setAccounts([hdAccount()])

        const discovery = state().discoverChains('hd')
        const enabling = state().enableChain('hd', ALGORAND, 'user')
        await vi.waitFor(() =>
            expect(families.checkActivity.get(BASE)).toHaveBeenCalled(),
        )

        expect(
            families.derivations.get(ALGORAND)?.deriveAccount,
        ).not.toHaveBeenCalled()
        releaseProbe()
        await discovery
        await expect(enabling).resolves.toMatchObject({
            chains: { [ALGORAND]: { enabledBy: 'user' } },
        })
    })

    test('leaves off a chain whose address another account already holds', async () => {
        families.active.add(BASE)
        const watcher = buildTestAccount(
            TEST_CUSTODY.watch,
            { [BASE]: { address: EVM_KEY_ADDRESS } },
            { id: 'watcher' },
        )
        state().setAccounts([
            buildTestAccount(
                TEST_CUSTODY.local,
                {
                    [ETHEREUM]: {
                        address: EVM_KEY_ADDRESS,
                        keyPairId: EVM_KEY_ID,
                    },
                },
                { id: 'key' },
            ),
            watcher,
        ])

        await expect(state().discoverChains('key')).resolves.toEqual([])
    })

    test('resolves to nothing for an unknown account', async () => {
        await expect(state().discoverChains('missing')).resolves.toEqual([])
    })
})
