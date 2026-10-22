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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { receiveTargetOf } from '../receiveTarget'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ADDRESS = 'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

const account = (address: string): WalletAccount => ({
    id: 'watch-1',
    name: 'Savings',
    custody: { kind: 'watch' },
    chains: { algorand: { address } },
})

describe('receiveTargetOf', () => {
    beforeEach(() => registerAlgorandAddressCodec())
    afterEach(() => addressCodecs.reset())

    it('encodes the chain payment URI for the account address', () => {
        expect(receiveTargetOf(account(ADDRESS), SCOPE)).toEqual({
            accountName: 'Savings',
            address: ADDRESS,
            paymentUri: `algorand://${ADDRESS}`,
        })
    })

    it('has no target without a receive scope', () => {
        expect(receiveTargetOf(account(ADDRESS), null)).toBeNull()
    })

    it('has no target for an address its chain rejects', () => {
        expect(receiveTargetOf(account('NOT-AN-ADDRESS'), SCOPE)).toBeNull()
    })

    it('has no target when no codec is registered for the chain', () => {
        addressCodecs.reset()

        expect(receiveTargetOf(account(ADDRESS), SCOPE)).toBeNull()
    })
})
