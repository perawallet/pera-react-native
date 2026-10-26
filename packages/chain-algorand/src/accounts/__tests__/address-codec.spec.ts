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

import { Decimal } from 'decimal.js'
import type { PaymentUriOpts } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandDescriptor } from '../../descriptor'
import { algorandAddressCodec } from '../address-codec'

const VALID = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'
const ASA = { chainId: ALGORAND_CHAIN_ID, assetId: '31566704' }
const { toPaymentUri, parsePaymentUri } = algorandAddressCodec

describe('algorandAddressCodec.resembles', () => {
    const KNOWN = '2SSSXMFNG55PKDGKJB7MLTGIRSIYAXFCJAWSQFD6C3M7L6JLG5NJIBTGAA'
    const LOOK_ALIKE =
        '2SSSXMBXVWYMJ33BCFI5PED5O7LMFJZWXXSAJCU44W5M4NP4Q5YIJBTGAA'

    it('takes an address differing only between the shown ends for a look-alike', () => {
        expect(algorandAddressCodec.resembles(LOOK_ALIKE, KNOWN)).toBe(true)
    })

    it('does not take the address itself for a look-alike', () => {
        expect(algorandAddressCodec.resembles(KNOWN, KNOWN)).toBe(false)
    })

    it('does not take an address with different shown ends for a look-alike', () => {
        expect(algorandAddressCodec.resembles(VALID, KNOWN)).toBe(false)
    })
})

describe('algorandAddressCodec payment URIs', () => {
    describe('round trip', () => {
        const awkward = 'a b & = ? # % + / é 😀'
        const cases: Array<[string, PaymentUriOpts]> = [
            ['no options', {}],
            ['amount', { amount: new Decimal('1500000') }],
            ['asset', { assetRef: ASA }],
            ['opt-in', { amount: new Decimal(0), assetRef: ASA }],
            ['uint64 max', { amount: new Decimal('18446744073709551615') }],
            ['escaped label and note', { label: awkward, note: awkward }],
            [
                'every field',
                {
                    amount: new Decimal('1500000'),
                    assetRef: ASA,
                    label: 'Coffee shop',
                    note: 'thanks',
                },
            ],
        ]

        it.each(cases)('%s', (_name, opts) => {
            expect(parsePaymentUri(toPaymentUri(VALID, opts))).toEqual({
                address: VALID,
                ...opts,
            })
        })
    })

    describe('toPaymentUri', () => {
        it('writes the bare address with no options', () => {
            expect(toPaymentUri(VALID)).toBe(`algorand://${VALID}`)
        })

        it('writes exact bytes with every field', () => {
            expect(
                toPaymentUri(VALID, {
                    amount: new Decimal('1500000'),
                    assetRef: ASA,
                    label: 'Coffee shop',
                    note: 'thanks',
                }),
            ).toBe(
                `algorand://${VALID}?amount=1500000&asset=31566704&label=Coffee%20shop&note=thanks`,
            )
        })

        it('omits the asset parameter for the native asset', () => {
            const uri = toPaymentUri(VALID, {
                amount: new Decimal(5),
                assetRef: algorandDescriptor.nativeAsset.ref,
            })

            expect(uri).toBe(`algorand://${VALID}?amount=5`)
            expect(parsePaymentUri(uri)?.assetRef).toBeUndefined()
        })

        it('writes large amounts as plain digits', () => {
            expect(toPaymentUri(VALID, { amount: new Decimal('1e21') })).toBe(
                `algorand://${VALID}?amount=1000000000000000000000`,
            )
        })

        it('does not write the network', () => {
            expect(toPaymentUri(VALID, { networkId: 'testnet' })).toBe(
                `algorand://${VALID}`,
            )
        })

        it.each([
            ['a fractional amount', { amount: new Decimal('1.5') }],
            ['a negative amount', { amount: new Decimal(-1) }],
            [
                'a foreign asset',
                {
                    assetRef: {
                        chainId: 'ethereum',
                        assetId: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
                    },
                },
            ],
            [
                'a non-numeric asset id',
                { assetRef: { chainId: ALGORAND_CHAIN_ID, assetId: 'abc' } },
            ],
        ] as Array<[string, PaymentUriOpts]>)('throws on %s', (_name, opts) => {
            expect(() => toPaymentUri(VALID, opts)).toThrow()
        })
    })

    describe('parsePaymentUri declines', () => {
        it.each([
            'ethereum:0x52908400098527886E0F7030069857D2E4169EE7',
            `algorand://${VALID}?amount=abc`,
            `algorand://${VALID}?amount=1.5`,
            `algorand://${VALID}?amount=-1`,
            `algorand://${VALID}?asset=abc`,
            `algorand://${VALID}?note=%E0%A4%A`,
            `algorand://${VALID}?amount=1&amount=2`,
            `algorand://${VALID}?type=keyreg&votekey=x`,
            `algorand://net:foonet-v1.0/${VALID}`,
            `algorand://gh:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=/${VALID}`,
            'algorand://asset/123',
            'algorand://?amount=0&asset=123',
            `algorand://${VALID.toLowerCase()}`,
        ])('%s', uri => {
            expect(parsePaymentUri(uri)).toBeUndefined()
        })
    })

    describe('parsePaymentUri accepts', () => {
        const parse = (search: string, path = VALID) =>
            parsePaymentUri(`algorand://${path}${search}`)

        it('the network the URI names', () => {
            expect(
                parsePaymentUri(
                    `algorand://net:testnet-v1.0/${VALID}?amount=1`,
                ),
            ).toEqual({
                address: VALID,
                amount: new Decimal(1),
                networkId: 'testnet',
            })
        })

        it('a trailing slash', () => {
            expect(parse('/?amount=1')?.amount).toEqual(new Decimal(1))
        })

        it('asset 0 as the native asset', () => {
            expect(parse('?asset=0')?.assetRef).toBeUndefined()
        })

        it('an asset id with leading zeros, canonicalized', () => {
            expect(parse('?asset=00031566704')?.assetRef?.assetId).toBe(
                '31566704',
            )
        })

        it('unknown keys and non-keyreg types, ignored', () => {
            expect(parse('?type=appl&xnote=x')).toEqual({ address: VALID })
        })

        it('percent-escapes in a label', () => {
            expect(parse('?label=My%20Address')?.label).toBe('My Address')
        })

        it('a literal plus', () => {
            expect(parse('?note=a+b')?.note).toBe('a+b')
        })

        it('an equals sign inside a value', () => {
            expect(parse('?note=a=b')?.note).toBe('a=b')
        })

        it('an unescaped question mark inside a value', () => {
            expect(parse('?note=a?b')?.note).toBe('a?b')
        })

        it('an empty amount as absent', () => {
            expect(parse('?amount=')).toEqual({ address: VALID })
        })
    })
})
