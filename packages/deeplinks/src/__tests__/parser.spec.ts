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
import {
    addressCodecs,
    type AddressCodec,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { deeplinkAdapters } from '../chain-adapter'
import { DeeplinkType } from '../links'
import { parseDeeplink } from '../parser'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'
import { registerPeraLinkChain } from './peraLinkChain'

const OTHER = 'fixturetwo' as ChainId
const otherCodec: AddressCodec = { ...fixtureCodec, chainId: OTHER }

const ADDRESS = `fx${'a'.repeat(40)}`
const PERA_ADDRESS = 'A'.repeat(58)

const registerFixtureChain = (): void => {
    addressCodecs.register(fixtureCodec)
    deeplinkAdapters.register(
        fakeDeeplinkAdapter(FIXTURE_CHAIN_ID, ['fixturehex'], fixtureCodec),
    )
}

describe('parseDeeplink', () => {
    afterEach(() => {
        addressCodecs.reset()
        deeplinkAdapters.reset()
    })

    describe('chain URIs', () => {
        beforeEach(() => registerFixtureChain())

        it('resolves a claimed URI through its adapter', () => {
            const link = parseDeeplink(`fixturehex:${ADDRESS}?amount=5`)

            expect(link).toMatchObject({
                type: DeeplinkType.TRANSFER,
                receiverAddress: ADDRESS,
                target: { chainId: FIXTURE_CHAIN_ID },
            })
        })

        it('returns null for a claimed URI the adapter refuses, never HOME, even when it contains /app/', () => {
            expect(parseDeeplink('fixturehex://app/1@somewhere')).toBeNull()
        })

        it('tries the chain adapters before the Pera /app/ parser', () => {
            expect(parseDeeplink(`fixturehex:${ADDRESS}`)?.type).toBe(
                DeeplinkType.ADDRESS_ACTIONS,
            )
        })

        it('reads a raw address as an address link on the one chain that accepts it', () => {
            expect(parseDeeplink(` ${ADDRESS}\n`)).toMatchObject({
                type: DeeplinkType.ADDRESS_ACTIONS,
                address: ADDRESS,
                target: { chainId: FIXTURE_CHAIN_ID },
            })
        })

        it('returns null for a raw address more than one chain accepts', () => {
            addressCodecs.register(otherCodec)

            expect(parseDeeplink(ADDRESS)).toBeNull()
        })
    })

    describe('Pera links', () => {
        beforeEach(() => registerPeraLinkChain())

        it('targets the Pera-link chain', () => {
            const link = parseDeeplink(
                `perawallet://app/add-contact/?address=${PERA_ADDRESS}`,
            )

            expect(link).toMatchObject({
                type: DeeplinkType.ADD_CONTACT,
                target: { chainId: expect.any(String) },
            })
        })

        it('returns null for an address the Pera-link codec rejects', () => {
            deeplinkAdapters.reset()
            addressCodecs.reset()
            registerPeraLinkChain(() => false)

            expect(
                parseDeeplink(
                    `perawallet://app/add-contact/?address=${PERA_ADDRESS}`,
                ),
            ).toBeNull()
        })

        it('returns null for an address when the Pera-link codec is not registered', () => {
            addressCodecs.reset()

            expect(
                parseDeeplink(
                    `perawallet://app/add-contact/?address=${PERA_ADDRESS}`,
                ),
            ).toBeNull()
        })

        it('passes a link that names no address', () => {
            expect(parseDeeplink('perawallet://app/home')?.type).toBe(
                DeeplinkType.HOME,
            )
        })

        it('parses the universal-link form', () => {
            expect(
                parseDeeplink(
                    `https://perawallet.app/qr/perawallet/app/account-detail?address=${PERA_ADDRESS}`,
                )?.type,
            ).toBe(DeeplinkType.ACCOUNT_DETAIL)
        })
    })

    describe('chain-agnostic formats', () => {
        it('leaves a wc: pairing URI unchanged', () => {
            const uri = `wc:${'c'.repeat(64)}@2?relay-protocol=irn&symKey=${'d'.repeat(64)}`

            expect(parseDeeplink(uri)).toMatchObject({
                type: DeeplinkType.WALLET_CONNECT,
                uri,
            })
        })

        it('parses fido: and liquid: as Liquid Auth', () => {
            expect(parseDeeplink('fido:/abc')).toMatchObject({
                type: DeeplinkType.LIQUID_AUTH,
                variant: 'fido',
            })
            expect(parseDeeplink('liquid://abc')).toMatchObject({
                type: DeeplinkType.LIQUID_AUTH,
                variant: 'liquid',
            })
        })

        it('parses the legacy mnemonic JSON and drops the payload from sourceUrl', () => {
            expect(
                parseDeeplink('{"version":1,"mnemonic":"one two three"}'),
            ).toEqual({
                type: DeeplinkType.RECOVER_ADDRESS,
                sourceUrl: '',
                mnemonic: 'one two three',
            })
        })

        it('returns null for text nothing claims', () => {
            expect(parseDeeplink('')).toBeNull()
            expect(parseDeeplink('https://example.com')).toBeNull()
            expect(parseDeeplink('{"mnemonic":""}')).toBeNull()
        })
    })
})
