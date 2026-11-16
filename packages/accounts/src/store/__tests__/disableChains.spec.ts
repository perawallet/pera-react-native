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
import { getProvider } from '@perawallet/wallet-extension-provider'
import { AccountNotFoundError, LastChainRemovalError } from '../../errors'
import { buildTestAccount } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    EVM_KEY_ADDRESS,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore } from '../store'

const imported = () =>
    buildTestAccount(
        { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
        {
            [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'algo-key' },
            [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'evm-key' },
            [BASE]: { address: EVM_KEY_ADDRESS, keyPairId: 'evm-key' },
        },
        { id: 'imported' },
    )

describe('disableChains', () => {
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        registerChainFamilies()
        vi.mocked(getProvider().key.store.remove).mockClear()
        state().resetState()
        state().setAccounts([imported()])
    })

    test('drops the entries and removes a key no chain signs with any more', async () => {
        const account = await state().disableChains('imported', [ALGORAND])

        expect(Object.keys(account.chains)).toEqual([ETHEREUM, BASE])
        expect(state().accounts[0]).toEqual(account)
        expect(getProvider().key.store.remove).toHaveBeenCalledWith('algo-key')
    })

    test('keeps a key another of its chains still signs with', async () => {
        await state().disableChains('imported', [ETHEREUM])

        expect(Object.keys(state().accounts[0]!.chains)).toEqual([
            ALGORAND,
            BASE,
        ])
        expect(getProvider().key.store.remove).not.toHaveBeenCalled()
    })

    test('refuses to leave the account on no chain', async () => {
        await expect(
            state().disableChains('imported', [ALGORAND, ETHEREUM, BASE]),
        ).rejects.toBeInstanceOf(LastChainRemovalError)
        expect(Object.keys(state().accounts[0]!.chains)).toHaveLength(3)
    })

    test('rejects an unknown account', async () => {
        await expect(
            state().disableChains('missing', [ALGORAND]),
        ).rejects.toBeInstanceOf(AccountNotFoundError)
    })
})
