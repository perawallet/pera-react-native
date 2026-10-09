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

import { beforeEach, describe, expect, it } from 'vitest'
import type { WalletAccount } from '../../models'
import { useAccountsStore } from '../store'
import { registerFakeAccountsChain } from '../../__tests__/fakeAccountsChain'
import { backfillAccountRecords } from '../backfillAccountRecords'

const held = (address: string): WalletAccount =>
    ({
        id: address,
        custody: { kind: 'local', seed: null },
        address,
        keyPairId: `kp-${address}`,
        chains: { algorand: { address, keyPairId: `kp-${address}` } },
    }) as WalletAccount

describe('backfillAccountRecords', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it("writes back each record its chain's backfillRecord changes", () => {
        registerFakeAccountsChain({
            backfillRecord: account =>
                account.address === 'A'
                    ? { ...account, name: 'backfilled' }
                    : account,
        })
        useAccountsStore.getState().setAccounts([held('A'), held('B')])

        backfillAccountRecords()

        expect(
            useAccountsStore.getState().accounts.map(({ name }) => name),
        ).toEqual(['backfilled', undefined])
    })

    it('leaves the store untouched when no chain changes anything', () => {
        registerFakeAccountsChain()
        useAccountsStore.getState().setAccounts([held('A')])
        const before = useAccountsStore.getState().accounts

        backfillAccountRecords()

        expect(useAccountsStore.getState().accounts).toBe(before)
    })
})
