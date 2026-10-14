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
import {
    DuplicateChainAdapterError,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import {
    deeplinkAdapters,
    DuplicateDeeplinkSchemeError,
    uriSchemeOf,
} from '../chain-adapter'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'

const OTHER = 'fixturetwo' as ChainId

describe('deeplinkAdapters', () => {
    afterEach(() => {
        deeplinkAdapters.reset()
    })

    it('registers adapters of two chains with disjoint schemes in order', () => {
        const a = fakeDeeplinkAdapter(
            FIXTURE_CHAIN_ID,
            ['fixturehex'],
            fixtureCodec,
        )
        const b = fakeDeeplinkAdapter(OTHER, ['fixturetwo'], fixtureCodec)

        deeplinkAdapters.register(a)
        deeplinkAdapters.register(b)

        expect(deeplinkAdapters.list()).toEqual([a, b])
    })

    it('refuses a scheme another chain claims, even when only one overlaps', () => {
        const a = fakeDeeplinkAdapter(
            FIXTURE_CHAIN_ID,
            ['fixturehex', 'shared'],
            fixtureCodec,
        )
        const b = fakeDeeplinkAdapter(
            OTHER,
            ['fixturetwo', 'shared'],
            fixtureCodec,
        )
        deeplinkAdapters.register(a)

        expect(() => deeplinkAdapters.register(b)).toThrow(
            DuplicateDeeplinkSchemeError,
        )
        expect(() => deeplinkAdapters.register(b)).toThrow(
            expect.objectContaining({
                scheme: 'shared',
                owner: FIXTURE_CHAIN_ID,
                chainId: OTHER,
            }),
        )
        expect(deeplinkAdapters.list()).toEqual([a])
    })

    it('treats re-registering the same instance as a no-op', () => {
        const a = fakeDeeplinkAdapter(
            FIXTURE_CHAIN_ID,
            ['fixturehex'],
            fixtureCodec,
        )

        deeplinkAdapters.register(a)
        deeplinkAdapters.register(a)

        expect(deeplinkAdapters.list()).toEqual([a])
    })

    it('refuses a different adapter for an already-registered chain', () => {
        deeplinkAdapters.register(
            fakeDeeplinkAdapter(FIXTURE_CHAIN_ID, ['fixturehex'], fixtureCodec),
        )

        expect(() =>
            deeplinkAdapters.register(
                fakeDeeplinkAdapter(FIXTURE_CHAIN_ID, ['other'], fixtureCodec),
            ),
        ).toThrow(DuplicateChainAdapterError)
    })
})

describe('uriSchemeOf', () => {
    it.each([
        ['fixturehex://x', 'fixturehex'],
        ['FIXTUREHEX:x', 'fixturehex'],
        ['fixture-wc:x', 'fixture-wc'],
        ['web+pay:x', 'web+pay'],
        ['', undefined],
        ['no-scheme-here', undefined],
        ['1abc:x', undefined],
        [' fixturehex:x', undefined],
    ])('reads %j as %j', (input, expected) => {
        expect(uriSchemeOf(input)).toBe(expected)
    })
})
