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
import {
    multisigChainAdapters,
    type MultisigChainAdapter,
} from '@perawallet/wallet-core-multisig'
import { multisigParametersOf, withMultisigParameters } from '../multisig'
import { buildTestAccount, TEST_CUSTODY, testAccount } from './accountFactory'
import { FAKE_CHAIN_ID } from './fakeAccountsChain'

const PARAMETERS = { version: 1, threshold: 2, addresses: ['P1', 'P2', 'P3'] }

// Only the storage half of the adapter is under test here.
const fakeMultisigAdapter = {
    chainId: FAKE_CHAIN_ID,
    parametersOf: native =>
        native?.multisig
            ? { ...native.multisig, addresses: [...native.multisig.addresses] }
            : undefined,
    toNative: ({ version, threshold, addresses }) => ({
        family: 'algorand',
        multisig: { version, threshold, addresses: [...addresses] },
    }),
} as Partial<MultisigChainAdapter> as MultisigChainAdapter

describe('multisig parameters on the account', () => {
    beforeEach(() => {
        multisigChainAdapters.reset()
        multisigChainAdapters.register(fakeMultisigAdapter)
    })

    it('stores parameters on the chain entry and reads them back', () => {
        const account = testAccount('multisig', 'MSIG')

        const stored = withMultisigParameters(
            account,
            FAKE_CHAIN_ID,
            PARAMETERS,
        )

        expect(stored.chains[FAKE_CHAIN_ID]).toEqual({
            address: 'MSIG',
            native: fakeMultisigAdapter.toNative(PARAMETERS),
        })
        expect(multisigParametersOf(stored, FAKE_CHAIN_ID)).toEqual(PARAMETERS)
        expect(account.chains[FAKE_CHAIN_ID]?.native).toBeUndefined()
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
                native: fakeMultisigAdapter.toNative(PARAMETERS),
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
        multisigChainAdapters.reset()

        expect(multisigParametersOf(stored, FAKE_CHAIN_ID)).toBeUndefined()
    })

    it('leaves an account with no entry on the chain unchanged', () => {
        const account = testAccount('multisig', 'MSIG')

        expect(withMultisigParameters(account, 'ethereum', PARAMETERS)).toBe(
            account,
        )
    })
})
