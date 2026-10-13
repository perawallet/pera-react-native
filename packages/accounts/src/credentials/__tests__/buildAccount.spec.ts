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

import { describe, test, expect } from 'vitest'
import type { AccountCustody } from '../../models'
import { AccountError } from '../../errors'
import { buildAccount, type BuildAccountInput } from '../buildAccount'
import { TEST_CUSTODY } from '../../__tests__/accountFactory'
import { FAKE_CHAIN_ID } from '../../__tests__/fakeAccountsChain'

const inputs: Record<keyof typeof TEST_CUSTODY, BuildAccountInput> = {
    local: {
        custody: TEST_CUSTODY.local,
        chainId: FAKE_CHAIN_ID,
        chains: { [FAKE_CHAIN_ID]: { address: 'ADDR', keyPairId: 'k-local' } },
    },
    explicit: {
        custody: TEST_CUSTODY.explicit,
        chainId: FAKE_CHAIN_ID,
        chains: {
            [FAKE_CHAIN_ID]: { address: 'ADDR', keyPairId: 'k-explicit' },
        },
    },
    hd: {
        custody: TEST_CUSTODY.hd,
        chainId: FAKE_CHAIN_ID,
        chains: { [FAKE_CHAIN_ID]: { address: 'ADDR', keyPairId: 'k-hd' } },
    },
    hardware: {
        custody: TEST_CUSTODY.hardware,
        chainId: FAKE_CHAIN_ID,
        chains: { [FAKE_CHAIN_ID]: { address: 'ADDR' } },
    },
    multisig: {
        custody: TEST_CUSTODY.multisig,
        chainId: FAKE_CHAIN_ID,
        chains: { [FAKE_CHAIN_ID]: { address: 'ADDR' } },
    },
    watch: {
        custody: TEST_CUSTODY.watch,
        chainId: FAKE_CHAIN_ID,
        chains: { [FAKE_CHAIN_ID]: { address: 'ADDR' } },
    },
}

describe('buildAccount', () => {
    test.each(Object.entries(inputs))(
        'a %s account holds only its id, custody and chains',
        (_kind, input) => {
            expect(buildAccount({ id: 'id', ...input })).toStrictEqual({
                id: 'id',
                custody: input.custody,
                chains: input.chains,
            })
        },
    )

    test('keeps every chain entry, not only the one it was built on', () => {
        const chains = {
            [FAKE_CHAIN_ID]: { address: 'ADDR', keyPairId: 'k1' },
            ethereum: { address: '0xabc', keyPairId: 'k2' },
        }

        expect(
            buildAccount({
                custody: TEST_CUSTODY.local,
                chainId: FAKE_CHAIN_ID,
                chains,
            }).chains,
        ).toStrictEqual(chains)
    })

    test('refuses an account with no entry on the chain it is built on', () => {
        expect(() =>
            buildAccount({
                custody: TEST_CUSTODY.watch,
                chainId: 'ethereum',
                chains: { [FAKE_CHAIN_ID]: { address: 'ADDR' } },
            }),
        ).toThrow(AccountError)
    })

    test('refuses a local custody without a key on its chain', () => {
        const input = {
            custody: TEST_CUSTODY.local,
            chainId: FAKE_CHAIN_ID,
            chains: { [FAKE_CHAIN_ID]: { address: 'ADDR' } },
        } as BuildAccountInput<AccountCustody>

        expect(() => buildAccount(input)).toThrow(AccountError)
    })

    test('passes the name through', () => {
        expect(
            buildAccount({ ...inputs.watch, name: 'Savings' }),
        ).toMatchObject({ name: 'Savings' })
    })

    test('generates a distinct id when none is given', () => {
        const first = buildAccount(inputs.watch)
        const second = buildAccount(inputs.watch)

        expect(first.id).toEqual(expect.any(String))
        expect(first.id).not.toBe(second.id)
    })
})
