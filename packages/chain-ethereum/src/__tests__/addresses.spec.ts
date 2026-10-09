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
import { Decimal } from 'decimal.js'
import { hexToBytes } from 'viem'
import { addressCodecContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import { ethereumAddressCodec as codec } from '../addresses'
import { ethereumDescriptor } from '../descriptor'

const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const HARDHAT_PUBLIC_KEY = hexToBytes(
    '0x048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5',
)
const TOKEN = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'

const EIP55_VECTORS = [
    '0x52908400098527886E0F7030069857D2E4169EE7',
    '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
    '0xde709f2102306220921060314715629080e2fb77',
    '0x27b1fdb04752bbc536007a920d24acb045561c26',
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
]

addressCodecContractTests(() => codec, {
    publicKey: HARDHAT_PUBLIC_KEY,
    deriveOpts: { scheme: 'secp256k1', networkId: 'mainnet' },
    equivalentSpellings: [
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
    ],
    invalid: [
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD',
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeA',
        '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        '0x' + 'g'.repeat(40),
        'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM',
    ],
    foreignUri:
        'algorand://EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM',
    paymentUriOpts: {
        networkId: 'sepolia',
        assetRef: { chainId: 'ethereum', assetId: TOKEN },
        amount: new Decimal('1500000'),
    },
})

describe('EIP-55', () => {
    it.each(EIP55_VECTORS)('accepts and round-trips %s', vector => {
        expect(codec.isValid(vector)).toBe(true)
        expect(codec.normalize(vector.toLowerCase())).toBe(vector)
        expect(codec.normalize(vector)).toBe(vector)
    })

    it('rejects an all-uppercase unchecksummed spelling', () => {
        expect(
            codec.isValid('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED'),
        ).toBe(false)
    })
})

describe('fromPublicKey', () => {
    const opts = { scheme: 'secp256k1', networkId: 'mainnet' } as const

    it('derives the checksummed address of an uncompressed key', () => {
        expect(codec.fromPublicKey(HARDHAT_PUBLIC_KEY, opts)).toBe(
            HARDHAT_ADDRESS,
        )
    })

    it.each([
        ['a compressed key', HARDHAT_PUBLIC_KEY.slice(0, 33)],
        [
            'a 65-byte key without the 0x04 prefix',
            Uint8Array.from(HARDHAT_PUBLIC_KEY, (byte, i) =>
                i === 0 ? 0x02 : byte,
            ),
        ],
    ])('throws for %s', (_label, key) => {
        expect(() => codec.fromPublicKey(key, opts)).toThrow()
    })

    it('throws for another signing scheme', () => {
        expect(() =>
            codec.fromPublicKey(HARDHAT_PUBLIC_KEY, {
                ...opts,
                scheme: 'ed25519',
            }),
        ).toThrow()
    })
})

describe('areEqual', () => {
    it('ignores case', () => {
        expect(
            codec.areEqual(HARDHAT_ADDRESS, HARDHAT_ADDRESS.toLowerCase()),
        ).toBe(true)
    })

    it('tells different addresses apart', () => {
        expect(codec.areEqual(EIP55_VECTORS[0], EIP55_VECTORS[1])).toBe(false)
    })
})

describe('toPaymentUri', () => {
    it('writes a native payment with the chain id and the amount in wei', () => {
        expect(
            codec.toPaymentUri(HARDHAT_ADDRESS, {
                networkId: 'mainnet',
                amount: new Decimal('1000000000000000000'),
            }),
        ).toBe(`ethereum:${HARDHAT_ADDRESS}@1?value=1000000000000000000`)
    })

    it('writes large amounts as plain digits', () => {
        expect(
            codec.toPaymentUri(HARDHAT_ADDRESS, {
                amount: new Decimal('1e21'),
            }),
        ).toBe(`ethereum:${HARDHAT_ADDRESS}?value=1000000000000000000000`)
    })

    it('writes an ERC-20 payment as a transfer call on the token contract', () => {
        expect(
            codec.toPaymentUri(HARDHAT_ADDRESS, {
                networkId: 'sepolia',
                assetRef: { chainId: 'ethereum', assetId: TOKEN },
                amount: new Decimal('1500000'),
            }),
        ).toBe(
            `ethereum:${TOKEN}@11155111/transfer?address=${HARDHAT_ADDRESS}&uint256=1500000`,
        )
    })

    it('treats the native asset ref as a plain payment', () => {
        expect(
            codec.toPaymentUri(HARDHAT_ADDRESS, {
                assetRef: ethereumDescriptor.nativeAsset.ref,
                amount: new Decimal(5),
            }),
        ).toBe(`ethereum:${HARDHAT_ADDRESS}?value=5`)
    })

    it('omits the chain id for a network the descriptor does not list', () => {
        expect(
            codec.toPaymentUri(HARDHAT_ADDRESS, { networkId: 'custom' }),
        ).toBe(`ethereum:${HARDHAT_ADDRESS}`)
    })

    it('drops label and note, which EIP-681 does not define', () => {
        expect(
            codec.toPaymentUri(HARDHAT_ADDRESS, {
                label: 'Coffee',
                note: 'thanks',
            }),
        ).toBe(`ethereum:${HARDHAT_ADDRESS}`)
    })

    it.each(['1.5', '-1'])('throws for the amount %s', amount => {
        expect(() =>
            codec.toPaymentUri(HARDHAT_ADDRESS, {
                amount: new Decimal(amount),
            }),
        ).toThrow()
    })
})

describe('parsePaymentUri', () => {
    it('reads a native request with exponent notation', () => {
        const parsed = codec.parsePaymentUri(
            'ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=2.014e18',
        )

        expect(parsed).toEqual({
            address: TOKEN,
            amount: new Decimal('2014000000000000000'),
        })
    })

    it('reads an ERC-20 transfer', () => {
        const parsed = codec.parsePaymentUri(
            'ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1',
        )

        expect(parsed).toEqual({
            address: '0x8e23Ee67d1332aD560396262C48ffbB01F93D052',
            assetRef: {
                chainId: 'ethereum',
                assetId: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
            },
            amount: new Decimal(1),
        })
    })

    it.each([
        ['1', 'mainnet'],
        ['11155111', 'sepolia'],
    ])('maps the chain id @%s to %s', (chainId, networkId) => {
        expect(
            codec.parsePaymentUri(`ethereum:pay-${HARDHAT_ADDRESS}@${chainId}`),
        ).toEqual({ address: HARDHAT_ADDRESS, networkId })
    })

    it.each([
        ['another EVM chain', `ethereum:${HARDHAT_ADDRESS}@137?value=1`],
        [
            'an unsupported function',
            'ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/approve?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1',
        ],
        [
            'a transfer without a recipient',
            'ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer?uint256=1',
        ],
        [
            'a bad checksum',
            'ethereum:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD',
        ],
        ['a fractional amount', `ethereum:${HARDHAT_ADDRESS}?value=1.5`],
        ['a non-numeric amount', `ethereum:${HARDHAT_ADDRESS}?value=abc`],
        ['a negative amount', `ethereum:${HARDHAT_ADDRESS}?value=-1`],
        ['an ENS name', 'ethereum:pay-vitalik.eth'],
    ])('declines %s', (_label, uri) => {
        expect(codec.parsePaymentUri(uri)).toBeUndefined()
    })
})
