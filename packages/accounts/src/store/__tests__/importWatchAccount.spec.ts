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

import { beforeEach, describe, expect, test } from 'vitest'
import { AccountError, DuplicateAccountError } from '../../errors'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    EVM_KEY_ADDRESS,
    POLYGON,
    registerChainFamilies,
    type ChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore } from '../store'

describe('importWatchAccount', () => {
    let families: ChainFamilies
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        families = registerChainFamilies()
        state().resetState()
    })

    test('watches the address on every chain where it has activity, in its canonical form', async () => {
        families.active.add(ETHEREUM).add(POLYGON)

        const account = await state().importWatchAccount(
            ETHEREUM,
            EVM_KEY_ADDRESS.toUpperCase().replace('0X', '0x'),
            'Treasury',
        )

        expect(account.name).toBe('Treasury')
        expect(account.custody).toEqual({ kind: 'watch' })
        expect(account.chains).toEqual({
            [ETHEREUM]: {
                address: EVM_KEY_ADDRESS,
                enabledAt: expect.any(Number),
                enabledBy: 'discovery',
            },
            [POLYGON]: {
                address: EVM_KEY_ADDRESS,
                enabledAt: expect.any(Number),
                enabledBy: 'discovery',
            },
        })
        expect(state().accounts).toEqual([account])
        expect(families.checkActivity.get(ALGORAND)).not.toHaveBeenCalled()
    })

    test('keeps only the chain it was added on, as created, when nothing has activity', async () => {
        const account = await state().importWatchAccount(
            ETHEREUM,
            EVM_KEY_ADDRESS,
        )

        expect(Object.keys(account.chains)).toEqual([ETHEREUM])
        expect(account.chains[ETHEREUM]?.enabledBy).toBe('created')
    })

    test('probes nothing for an address only one chain accepts', async () => {
        await state().importWatchAccount(ALGORAND, ALGORAND_ADDRESS)

        for (const probe of families.checkActivity.values()) {
            expect(probe).not.toHaveBeenCalled()
        }
    })

    test('enables a new chain on the watch account already holding the address', async () => {
        const watcher = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
            { id: 'watcher' },
        )
        state().setAccounts([watcher])

        const result = await state().importWatchAccount(BASE, EVM_KEY_ADDRESS)

        expect(result.id).toBe('watcher')
        expect(state().accounts).toHaveLength(1)
        expect(result.chains[BASE]?.enabledBy).toBe('user')
    })

    test('refuses an address already held on the chain', async () => {
        await state().importWatchAccount(ETHEREUM, EVM_KEY_ADDRESS)

        await expect(
            state().importWatchAccount(ETHEREUM, EVM_KEY_ADDRESS),
        ).rejects.toBeInstanceOf(DuplicateAccountError)
        expect(state().accounts).toHaveLength(1)
    })

    test("refuses an address the chain's codec rejects", async () => {
        await expect(
            state().importWatchAccount(ALGORAND, EVM_KEY_ADDRESS),
        ).rejects.toBeInstanceOf(AccountError)
        expect(state().accounts).toEqual([])
    })
})
