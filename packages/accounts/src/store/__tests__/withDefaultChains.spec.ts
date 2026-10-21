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
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    familyHdAddress,
    familyHdKeyId,
    registerChainFamilies,
    type ChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore, withDefaultChains } from '../store'

const HD_SEED = 'hd-seed'
const ETHEREUM_KEY = familyHdKeyId(HD_SEED, 'evm', 0, 0)
const ETHEREUM_ADDRESS = familyHdAddress('evm', 0, 0)

const hdDraft = () =>
    buildTestAccount(
        TEST_CUSTODY.hd,
        { [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'hd-key' } },
        { id: 'draft' },
    )

describe('withDefaultChains', () => {
    let families: ChainFamilies
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        families = registerChainFamilies()
        getKeystoreStore().state.keys = [
            { id: HD_SEED, type: 'seed', metadata: { scheme: 'bip39' } },
            {
                id: 'hd-key',
                type: 'ed25519',
                metadata: { parentKeyId: HD_SEED },
            },
        ] as never
        vi.mocked(getProvider().key.store.remove).mockClear()
        state().resetState()
    })

    test('adds every default chain the draft lacks, as created, at its own HD position', async () => {
        const account = await withDefaultChains(hdDraft())

        expect(Object.keys(account.chains)).toEqual([ALGORAND, ETHEREUM])
        expect(account.chains[ETHEREUM]).toEqual({
            address: ETHEREUM_ADDRESS,
            keyPairId: ETHEREUM_KEY,
            enabledAt: expect.any(Number),
            enabledBy: 'created',
        })
        expect(
            families.derivations.get(ETHEREUM)?.deriveAccount,
        ).toHaveBeenCalledWith(expect.anything(), HD_SEED, 0, 0, {
            scheme: 'secp256k1',
            networkId: expect.any(String),
        })
        expect(
            families.derivations.get(BASE)?.deriveAccount,
        ).not.toHaveBeenCalled()
    })

    test('writes nothing to the store', async () => {
        await withDefaultChains(hdDraft())

        expect(state().accounts).toEqual([])
    })

    test('leaves the draft as it is when Algorand is the only chain', async () => {
        registerChainFamilies([ALGORAND])
        const draft = hdDraft()

        await expect(withDefaultChains(draft)).resolves.toEqual(draft)
    })

    test('leaves off a default chain whose address another account holds, and removes the key it derived for it', async () => {
        state().setAccounts([
            buildTestAccount(
                TEST_CUSTODY.watch,
                { [ETHEREUM]: { address: ETHEREUM_ADDRESS } },
                { id: 'watcher' },
            ),
        ])

        const account = await withDefaultChains(hdDraft())

        expect(Object.keys(account.chains)).toEqual([ALGORAND])
        expect(getProvider().key.store.remove).toHaveBeenCalledWith(
            ETHEREUM_KEY,
        )
    })

    test('leaves off a default chain whose derivation fails, without rejecting', async () => {
        vi.mocked(
            families.derivations.get(ETHEREUM)!.deriveAccount,
        ).mockRejectedValueOnce(new Error('keystore locked'))

        const account = await withDefaultChains(hdDraft())

        expect(Object.keys(account.chains)).toEqual([ALGORAND])
    })
})
