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
    accountsChainAdapters,
    buildAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    keyDerivations,
    type ChainContext,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumAddressCodec } from '../accounts/address-codec'
import { ethereumKeyDerivation } from '../accounts/key-derivation'
import { registerChain } from '../register'

const ADDRESS = '0x00000000000000000000000000000000000000aa'
const context = {} as ChainContext

describe('registerChain', () => {
    beforeEach(() => {
        addressCodecs.reset()
        keyDerivations.reset()
        accountsChainAdapters.reset()
    })

    it('registers the address codec, key derivation and accounts adapter', () => {
        registerChain(context)

        expect(addressCodecs.get('ethereum')).toBe(ethereumAddressCodec)
        expect(keyDerivations.get('ethereum')).toBe(ethereumKeyDerivation)
        expect(accountsChainAdapters.get('ethereum').chainId).toBe('ethereum')
    })

    it('can run more than once, so a repeated bootstrap is harmless', () => {
        registerChain(context)

        expect(() => registerChain({ ...context })).not.toThrow()
    })

    it.each([
        [
            'an HD entry',
            {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 1, keyIndex: 2 },
            } as const,
            'seed-1-eth-acc1-idx2',
        ],
        ['a private-key account', { kind: 'local', seed: null } as const, 'k'],
        ['a watch account', { kind: 'watch' } as const, undefined],
    ])('lets buildAccount build %s on Ethereum', (_, custody, keyPairId) => {
        registerChain(context)

        const account = buildAccount({
            custody,
            chainId: 'ethereum',
            chains: { ethereum: { address: ADDRESS, keyPairId } },
        })

        expect(account.address).toBe(ADDRESS)
        expect(account.custody).toEqual(custody)
    })
})
