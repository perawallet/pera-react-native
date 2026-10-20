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

import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest'
import type { AccountCustody } from '../../models'
import { AccountError } from '../../errors'
import {
    buildAccount,
    withEnablement,
    type BuildAccountInput,
} from '../buildAccount'
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

const NOW = 1_700_000_000_000

const createdAt = (chains: BuildAccountInput['chains']) =>
    Object.fromEntries(
        Object.entries(chains).map(([id, entry]) => [
            id,
            { ...entry, enabledAt: NOW, enabledBy: 'created' },
        ]),
    )

describe('buildAccount', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test.each(Object.entries(inputs))(
        'a %s account holds only its id, custody and chains',
        (_kind, input) => {
            expect(buildAccount({ id: 'id', ...input })).toStrictEqual({
                id: 'id',
                custody: input.custody,
                chains: createdAt(input.chains),
            })
        },
    )

    test('records the given enabler on every entry that has none', () => {
        const account = buildAccount({
            ...inputs.watch,
            chains: {
                [FAKE_CHAIN_ID]: { address: 'ADDR' },
                ethereum: {
                    address: '0xabc',
                    enabledAt: 5,
                    enabledBy: 'discovery',
                },
            },
            enabledBy: 'restore',
        })

        expect(account.chains).toStrictEqual({
            [FAKE_CHAIN_ID]: {
                address: 'ADDR',
                enabledAt: NOW,
                enabledBy: 'restore',
            },
            ethereum: {
                address: '0xabc',
                enabledAt: 5,
                enabledBy: 'discovery',
            },
        })
    })

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
        ).toStrictEqual(createdAt(chains))
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

describe('withEnablement', () => {
    test('stamps an entry that carries no enablement', () => {
        expect(withEnablement({ address: 'A' }, 'user', 7)).toStrictEqual({
            address: 'A',
            enabledAt: 7,
            enabledBy: 'user',
        })
    })

    test('keeps the enablement an entry already has', () => {
        const entry = {
            address: 'A',
            enabledAt: 0,
            enabledBy: 'created',
        } as const

        expect(withEnablement(entry, 'restore', 9)).toBe(entry)
    })
})
