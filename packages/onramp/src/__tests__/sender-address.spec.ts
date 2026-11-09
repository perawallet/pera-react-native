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

import type { RampToken } from '../models'
import { isPlausibleRampSenderAddress } from '../sender-address'

const depositToken = (id: string): RampToken => ({
    id,
    kind: 'deposit',
    symbol: 'COIN',
    name: 'Coin',
    fractionDecimals: 8,
    logo: null,
    network: { name: 'Network', logo: null },
})

const EVM = depositToken(
    'eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
)
const SOLANA = depositToken(
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
)
const BITCOIN = depositToken('bip122:000000000019d6689c085ae165831e93/slip44:0')
const TRON = depositToken('tron:0x2b6653dc/slip44:195')
const OTHER = depositToken('cosmos:cosmoshub-4/slip44:118')
const FIAT: RampToken = {
    ...depositToken('swift:0/iso4217:USD'),
    kind: 'fiat',
}

describe('isPlausibleRampSenderAddress', () => {
    it.each([
        ['an EVM address', EVM, '0x52908400098527886E0F7030069857D2E4169EE7'],
        [
            'a Solana address',
            SOLANA,
            '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
        ],
        [
            'a legacy Bitcoin address',
            BITCOIN,
            '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        ],
        [
            'a bech32 Bitcoin address',
            BITCOIN,
            'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        ],
        [
            'an upper-case bech32 Bitcoin address',
            BITCOIN,
            'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ',
        ],
        ['a Tron address', TRON, 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH'],
        ['any unbroken text on an unknown chain', OTHER, 'cosmos1abcdef'],
    ])('accepts %s', (_label, token, address) => {
        expect(isPlausibleRampSenderAddress(token, address)).toBe(true)
    })

    it.each([
        ['a short EVM address', EVM, '0x1234'],
        [
            'a Bitcoin address on an EVM source',
            EVM,
            '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        ],
        [
            'an EVM address on a Solana source',
            SOLANA,
            '0x52908400098527886E0F7030069857D2E4169EE7',
        ],
        [
            'a Solana address with a non-base58 character',
            SOLANA,
            '0EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
        ],
        [
            'mixed-case bech32',
            BITCOIN,
            'bc1QAR0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        ],
        [
            'a Tron address of the wrong length',
            TRON,
            'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZ',
        ],
        ['inner whitespace on an unknown chain', OTHER, 'cosmos1 abcdef'],
    ])('rejects %s', (_label, token, address) => {
        expect(isPlausibleRampSenderAddress(token, address)).toBe(false)
    })

    it('trims before checking', () => {
        expect(
            isPlausibleRampSenderAddress(
                EVM,
                '  0x52908400098527886E0F7030069857D2E4169EE7 ',
            ),
        ).toBe(true)
    })

    it.each(['', '   '])(
        'treats %j as plausible, since the field is optional',
        address => {
            expect(isPlausibleRampSenderAddress(BITCOIN, address)).toBe(true)
        },
    )

    it('treats any address as plausible for a fiat source', () => {
        expect(isPlausibleRampSenderAddress(FIAT, 'not an address')).toBe(true)
    })
})
