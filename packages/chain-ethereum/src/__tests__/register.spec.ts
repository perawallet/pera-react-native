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
import { assetsChainAdapters } from '@perawallet/wallet-core-assets'
import {
    broadcasterChainAdapters,
    messageSignerChainAdapters,
} from '@perawallet/wallet-core-signing'
import {
    addressCodecs,
    keyDerivations,
    transactionPlanners,
    transactionReviewers,
    type ChainContext,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections/dappRequest'
import { deeplinkAdapters } from '@perawallet/wallet-core-deeplinks'
import {
    historyChainAdapters,
    transferChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { ethereumAddressCodec } from '../accounts/address-codec'
import { ethereumDeeplinkAdapter } from '../deeplinks/adapter'
import { ethereumKeyDerivation } from '../accounts/key-derivation'
import { ETHEREUM_NATIVE_ASSET } from '../assets/native-asset'
import { ethereumDappRequestAdapter } from '../connect/dappRequestAdapter'
import { ethereumHistoryAdapter } from '../history'
import { registerChain } from '../register'
import { ethereumPlannerAdapter } from '../signing/adapter'
import { ethereumMessageSignerAdapter } from '../signing/messages'
import { ethereumReviewerAdapter } from '../signing/review'

const ADDRESS = '0x00000000000000000000000000000000000000aa'
const context = {} as ChainContext

describe('registerChain', () => {
    beforeEach(() => {
        addressCodecs.reset()
        keyDerivations.reset()
        transactionPlanners.reset()
        transactionReviewers.reset()
        messageSignerChainAdapters.reset()
        accountsChainAdapters.reset()
        assetsChainAdapters.reset()
        transferChainAdapters.reset()
        historyChainAdapters.reset()
        broadcasterChainAdapters.reset()
        dappRequestChainAdapters.reset()
        deeplinkAdapters.reset()
    })

    it('registers the address codec, key derivation, planner, reviewer, message signer, and accounts, assets, transfer, broadcaster, history, dApp request and deeplink adapters', () => {
        registerChain(context)

        expect(addressCodecs.get('ethereum')).toBe(ethereumAddressCodec)
        expect(keyDerivations.get('ethereum')).toBe(ethereumKeyDerivation)
        expect(transactionPlanners.get('ethereum')).toBe(ethereumPlannerAdapter)
        expect(transactionReviewers.get('ethereum')).toBe(
            ethereumReviewerAdapter,
        )
        expect(messageSignerChainAdapters.get('ethereum')).toBe(
            ethereumMessageSignerAdapter,
        )
        expect(accountsChainAdapters.get('ethereum').chainId).toBe('ethereum')
        expect(assetsChainAdapters.get('ethereum').getNativeAsset()).toBe(
            ETHEREUM_NATIVE_ASSET,
        )
        expect(transferChainAdapters.get('ethereum').chainId).toBe('ethereum')
        expect(broadcasterChainAdapters.get('ethereum').chainId).toBe(
            'ethereum',
        )
        expect(historyChainAdapters.get('ethereum')).toBe(
            ethereumHistoryAdapter,
        )
        expect(dappRequestChainAdapters.get('ethereum')).toBe(
            ethereumDappRequestAdapter,
        )
        expect(deeplinkAdapters.get('ethereum')).toBe(ethereumDeeplinkAdapter)
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

        expect(account.chains.ethereum?.address).toBe(ADDRESS)
        expect(account.custody).toEqual(custody)
    })
})
