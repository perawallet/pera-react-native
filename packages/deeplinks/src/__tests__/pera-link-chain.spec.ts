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

import { afterEach, describe, expect, it } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { deeplinkAdapters } from '../chain-adapter'
import {
    PERA_LINK_CHAIN_ID,
    toPeraKeyregAction,
    toPeraLinkAssetRef,
    toPeraPaymentData,
} from '../pera-link-chain'
import { registerPeraLinkChain } from './peraLinkChain'

describe('pera-link-chain', () => {
    afterEach(() => {
        addressCodecs.reset()
        deeplinkAdapters.reset()
    })

    describe('toPeraKeyregAction', () => {
        it('lets an explicit keyregType win over the keys', () => {
            expect(
                toPeraKeyregAction({
                    sender: 'S',
                    keyregType: 'offline',
                    voteKey: 'k',
                })?.keyregType,
            ).toBe('offline')
        })

        it('infers online from any participation key, and offline from none', () => {
            expect(
                toPeraKeyregAction({ sender: 'S', voteFirst: '1' })
                    ?.keyregType,
            ).toBe('online')
            expect(toPeraKeyregAction({ sender: 'S' })?.keyregType).toBe(
                'offline',
            )
        })

        it('reads the fee as base units', () => {
            expect(
                toPeraKeyregAction({ sender: 'S', fee: '2000' })?.fee?.toFixed(),
            ).toBe('2000')
        })

        it('is undefined for a fee that is not digits', () => {
            expect(
                toPeraKeyregAction({ sender: 'S', fee: 'abc' }),
            ).toBeUndefined()
        })
    })

    describe('toPeraLinkAssetRef', () => {
        it('maps an id through the registered adapter', () => {
            registerPeraLinkChain()

            expect(toPeraLinkAssetRef('31566704')).toEqual({
                chainId: PERA_LINK_CHAIN_ID,
                assetId: '31566704',
            })
            expect(toPeraLinkAssetRef('abc')).toBeUndefined()
        })

        it('is undefined when no adapter is registered', () => {
            expect(toPeraLinkAssetRef('1')).toBeUndefined()
        })
    })

    describe('toPeraPaymentData', () => {
        it('carries the locked note, and nothing when there is none', () => {
            expect(toPeraPaymentData('locked')).toMatchObject({
                xnote: 'locked',
            })
            expect(toPeraPaymentData(undefined)).toBeUndefined()
            expect(toPeraPaymentData('')).toBeUndefined()
        })
    })
})
