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

import { describe, expect, it } from 'vitest'
import { MultisigUnsupportedError } from '../errors'
import { multisigParametersOf, withMultisigParameters } from '../multisig'
import { buildTestAccount, TEST_CUSTODY, testAccount } from './accountFactory'
import {
    FAKE_CHAIN_ID,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

const PARAMETERS = { version: 1, threshold: 2, addresses: ['P1', 'P2', 'P3'] }

const storedNative = () =>
    fakeAccountsChain().adapter.multisigNative!.withParameters(
        undefined,
        PARAMETERS,
    )

describe('multisig parameters on the account', () => {
    it('stores parameters on the chain entry and reads them back', () => {
        const account = testAccount('multisig', 'MSIG')

        const stored = withMultisigParameters(
            account,
            FAKE_CHAIN_ID,
            PARAMETERS,
        )

        expect(stored.chains[FAKE_CHAIN_ID]).toEqual({
            address: 'MSIG',
            native: storedNative(),
        })
        expect(multisigParametersOf(stored, FAKE_CHAIN_ID)).toEqual(PARAMETERS)
        expect(account.chains[FAKE_CHAIN_ID]?.native).toBeUndefined()
    })

    it("keeps the rest of the entry's native data", () => {
        const pq = { scheme: 'falcon-1024' as const, publicKey: 'cGs=' }
        const account = buildTestAccount(TEST_CUSTODY.multisig, {
            [FAKE_CHAIN_ID]: {
                address: 'MSIG',
                native: { family: 'algorand', pq },
            },
        })

        const stored = withMultisigParameters(
            account,
            FAKE_CHAIN_ID,
            PARAMETERS,
        )

        expect(stored.chains[FAKE_CHAIN_ID]?.native?.pq).toEqual(pq)
        expect(multisigParametersOf(stored, FAKE_CHAIN_ID)).toEqual(PARAMETERS)
    })

    it('reads none from a multisig record that lacks them', () => {
        expect(
            multisigParametersOf(
                testAccount('multisig', 'MSIG'),
                FAKE_CHAIN_ID,
            ),
        ).toBeUndefined()
    })

    it('reads none from an account that is not a multisig', () => {
        const local = buildTestAccount(TEST_CUSTODY.local, {
            [FAKE_CHAIN_ID]: {
                address: 'A',
                keyPairId: 'k',
                native: storedNative(),
            },
        })

        expect(multisigParametersOf(local, FAKE_CHAIN_ID)).toBeUndefined()
    })

    it('reads none on a chain without multisig', () => {
        const stored = withMultisigParameters(
            testAccount('multisig', 'MSIG'),
            FAKE_CHAIN_ID,
            PARAMETERS,
        )
        registerFakeAccountsChain({ multisigNative: undefined })

        expect(multisigParametersOf(stored, FAKE_CHAIN_ID)).toBeUndefined()
    })

    it('refuses to store parameters on a chain without multisig', () => {
        registerFakeAccountsChain({ multisigNative: undefined })

        expect(() =>
            withMultisigParameters(
                testAccount('multisig', 'MSIG'),
                FAKE_CHAIN_ID,
                PARAMETERS,
            ),
        ).toThrow(MultisigUnsupportedError)
    })

    it('leaves an account with no entry on the chain unchanged', () => {
        const account = testAccount('multisig', 'MSIG')

        expect(withMultisigParameters(account, 'ethereum', PARAMETERS)).toBe(
            account,
        )
    })
})
