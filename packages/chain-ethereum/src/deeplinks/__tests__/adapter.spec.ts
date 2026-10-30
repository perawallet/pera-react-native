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

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { maxUint256 } from 'viem'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { createEvmAddressCodec } from '../../accounts/address-codec'
import { createEvmDeeplinkAdapter } from '../adapter'
import { BASE, ETHEREUM, POLYGON } from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'

const adapter = createEvmDeeplinkAdapter(ETHEREUM)

const registerCodecs = (...chains: EvmChain[]) => {
    addressCodecs.reset()
    for (const chain of chains) {
        addressCodecs.register(createEvmAddressCodec(chain))
    }
}

beforeAll(() => registerCodecs(ETHEREUM))
afterAll(() => addressCodecs.reset())

const NATIVE_LOWER = '0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'
const NATIVE = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'
const BAD_CHECKSUM = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD'
const GOOD_CHECKSUM = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const TOKEN_LOWER = '0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7'
const TOKEN = '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7'
const TO_LOWER = '0x8e23ee67d1332ad560396262c48ffbb01f93d052'
const TO = '0x8e23Ee67d1332aD560396262C48ffbB01F93D052'
const ONE_ETHER = new Decimal('1000000000000000000')
const UINT256_OVERFLOW =
    '115792089237316195423570985008687907853269984665640564039457584007913129639936'

const failure = (input: string) => {
    const result = adapter.parse(input)
    return result.ok ? undefined : result.reason
}

describe('EIP-681 examples', () => {
    it('parses the native example with a scientific-notation value', () => {
        expect(
            adapter.parse(`ethereum:${NATIVE_LOWER}?value=2.014e18`),
        ).toEqual({
            ok: true,
            intent: {
                kind: 'payment',
                target: { chainId: 'ethereum' },
                recipient: NATIVE,
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                amount: new Decimal('2014000000000000000'),
            },
        })
    })

    it('refuses the specification spelling of the native example because its mixed-case checksum is wrong', () => {
        expect(
            failure(
                'ethereum:0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359?value=2.014e18',
            ),
        ).toBe('malformed')
    })

    it('parses the ERC-20 example', () => {
        const result = adapter.parse(
            `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=1`,
        )

        expect(result).toEqual({
            ok: true,
            intent: {
                kind: 'payment',
                target: { chainId: 'ethereum' },
                recipient: TO,
                assetRef: { chainId: 'ethereum', assetId: TOKEN },
                amount: new Decimal(1),
            },
        })
    })
})

describe('network', () => {
    it('resolves the chain id to a network id', () => {
        const mainnet = adapter.parse(`ethereum:${NATIVE}@1?value=1`)
        const sepolia = adapter.parse(`ethereum:pay-${NATIVE}@11155111?value=1`)

        expect(mainnet.ok && mainnet.intent).toMatchObject({
            target: { chainId: 'ethereum', networkId: 'mainnet' },
        })
        expect(sepolia.ok && sepolia.intent).toMatchObject({
            target: { chainId: 'ethereum', networkId: 'sepolia' },
        })
    })

    it('leaves the network unset when the link has no chain id', () => {
        const result = adapter.parse(`ethereum:${NATIVE}?value=1`)

        expect(
            result.ok &&
                result.intent.kind === 'payment' &&
                result.intent.target,
        ).toStrictEqual({ chainId: 'ethereum' })
    })

    it.each([`ethereum:${NATIVE}@137`, `ethereum:${NATIVE}@137?value=1`])(
        'refuses an undeclared network: %s',
        input => {
            expect(failure(input)).toBe('unsupported-network')
        },
    )

    it.each([`ethereum:${NATIVE}@abc`, `ethereum:${NATIVE}@`])(
        'refuses a chain id that is not a number: %s',
        input => {
            expect(failure(input)).toBe('malformed')
        },
    )
})

describe('function calls', () => {
    it.each(['approve', 'setApprovalForAll'])(
        'refuses %s as an unsupported action',
        fn => {
            expect(
                failure(
                    `ethereum:${TOKEN_LOWER}/${fn}?address=${TO_LOWER}&uint256=1`,
                ),
            ).toBe('unsupported-action')
        },
    )

    it('refuses a transfer that also carries a value', () => {
        expect(
            failure(
                `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=1&value=1`,
            ),
        ).toBe('unsupported-action')
    })

    it('refuses a trailing slash with no function', () => {
        expect(failure(`ethereum:${NATIVE}/`)).toBe('malformed')
    })

    it('refuses a transfer with no address', () => {
        expect(failure(`ethereum:${TOKEN_LOWER}/transfer?uint256=1`)).toBe(
            'malformed',
        )
    })
})

describe('addresses', () => {
    it('refuses a wrong-checksum target and a wrong-checksum transfer recipient', () => {
        expect(failure(`ethereum:${BAD_CHECKSUM}?value=1`)).toBe('malformed')
        expect(
            failure(
                `ethereum:${TOKEN_LOWER}/transfer?address=${BAD_CHECKSUM}&uint256=1`,
            ),
        ).toBe('malformed')
    })

    it('accepts all-lowercase addresses and normalizes them to the checksum form', () => {
        const result = adapter.parse(
            `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}`,
        )

        expect(result.ok && result.intent).toMatchObject({
            recipient: TO,
            assetRef: { assetId: TOKEN },
        })
    })

    it.each([
        'ethereum:vitalik.eth',
        'ethereum:pay-vitalik.eth@1?value=1',
        `ethereum:${TOKEN_LOWER}/transfer?address=vitalik.eth&uint256=1`,
    ])('refuses an ENS name as unsupported: %s', input => {
        expect(failure(input)).toBe('unsupported-action')
    })

    it('does not own a bare address', () => {
        expect(adapter.canParse(GOOD_CHECKSUM)).toBe(false)
        expect(failure(GOOD_CHECKSUM)).toBe('malformed')
    })
})

describe('amounts', () => {
    const value = (raw: string) => {
        const result = adapter.parse(`ethereum:${NATIVE}?value=${raw}`)
        return result.ok && result.intent.kind === 'payment'
            ? result.intent.amount
            : undefined
    }

    it('expands scientific notation and accepts zero', () => {
        expect(value('1.5e1')).toEqual(new Decimal(15))
        expect(value('0')).toEqual(new Decimal(0))
    })

    it.each(['1.5', '2.0145e3', '-1', 'abc', '1e-3', '1e999999'])(
        'refuses value=%s',
        raw => {
            expect(failure(`ethereum:${NATIVE}?value=${raw}`)).toBe('malformed')
        },
    )

    it('refuses a uint256 above the largest uint256', () => {
        expect(
            failure(
                `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=${UINT256_OVERFLOW}`,
            ),
        ).toBe('malformed')
    })

    it('accepts a uint256 equal to the largest uint256', () => {
        const result = adapter.parse(
            `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=${maxUint256}`,
        )

        expect(result.ok && result.intent.kind === 'payment').toBe(true)
        expect(
            result.ok && result.intent.kind === 'payment'
                ? result.intent.amount
                : undefined,
        ).toEqual(new Decimal(maxUint256.toString()))
    })

    it.each([
        `ethereum:${NATIVE}?value=1&value=2`,
        `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=1&uint256=2`,
        `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&address=${TO_LOWER}`,
    ])('refuses a repeated param: %s', input => {
        expect(failure(input)).toBe('malformed')
    })
})

describe('ignored params', () => {
    it('ignores gas, gasLimit and gasPrice', () => {
        const plain = adapter.parse(`ethereum:${NATIVE}?value=1`)

        expect(
            adapter.parse(
                `ethereum:${NATIVE}?value=1&gas=21000&gasLimit=abc&gasPrice=1`,
            ),
        ).toEqual(plain)
    })

    it.each(['gas=%', 'note=%zz', 'label=%E0%A4%A'])(
        'does not throw on a bad escape in an ignored param: %s',
        extra => {
            const plain = adapter.parse(`ethereum:${NATIVE}?value=1`)

            expect(
                adapter.parse(`ethereum:${NATIVE}?value=1&${extra}`),
            ).toEqual(plain)
        },
    )

    it.each([`value=%`, `value=1=999`])(
        'refuses a malformed read of a used param: %s',
        query => {
            expect(failure(`ethereum:${NATIVE}?${query}`)).toBe('malformed')
        },
    )

    it('refuses a transfer amount that carries a second equals sign', () => {
        expect(
            failure(
                `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=1=999`,
            ),
        ).toBe('malformed')
    })
})

describe('scheme', () => {
    it('parses an uppercase scheme like the lowercase one', () => {
        expect(adapter.parse(`ETHEREUM:${NATIVE}?value=1`)).toEqual(
            adapter.parse(`ethereum:${NATIVE}?value=1`),
        )
    })
})

describe('toAssetRef', () => {
    it('gives the checksummed ref for either spelling of a valid address', () => {
        const ref = { chainId: 'ethereum', assetId: TOKEN }

        expect(adapter.toAssetRef(TOKEN)).toEqual(ref)
        expect(adapter.toAssetRef(TOKEN_LOWER)).toEqual(ref)
    })

    it.each([BAD_CHECKSUM, 'native', ''])('gives nothing for %j', raw => {
        expect(adapter.toAssetRef(raw)).toBeUndefined()
    })
})

describe('links for other EVM chains', () => {
    beforeEach(() => registerCodecs(ETHEREUM, BASE, POLYGON))
    afterAll(() => registerCodecs(ETHEREUM))

    const paymentOf = (parse: typeof adapter.parse, input: string) => {
        const result = parse(input)
        return result.ok && result.intent.kind === 'payment'
            ? result.intent
            : undefined
    }
    const targetOf = (input: string) => paymentOf(adapter.parse, input)?.target

    it.each([
        ['8453', { chainId: 'base', networkId: 'mainnet' }],
        ['84532', { chainId: 'base', networkId: 'sepolia' }],
        ['137', { chainId: 'polygon', networkId: 'mainnet' }],
        ['1', { chainId: 'ethereum', networkId: 'mainnet' }],
    ])('reads @%s as %o', (eip155ChainId, target) => {
        expect(targetOf(`ethereum:${NATIVE}@${eip155ChainId}`)).toEqual(target)
    })

    it("pays in the resolved chain's native coin and tokens", () => {
        const token = paymentOf(
            adapter.parse,
            `ethereum:${TOKEN_LOWER}@137/transfer?address=${TO_LOWER}&uint256=1`,
        )
        const native = paymentOf(
            adapter.parse,
            `ethereum:${NATIVE}@8453?value=1`,
        )

        expect(token?.assetRef).toEqual({
            chainId: 'polygon',
            assetId: TOKEN,
        })
        expect(native?.assetRef).toEqual({
            chainId: 'base',
            assetId: 'native',
        })
    })

    it('rejects an EIP-155 id no chain owns', () => {
        expect(failure(`ethereum:${NATIVE}@999999`)).toBe('unsupported-network')
    })

    it('rejects a chain this build does not register', () => {
        expect(failure(`ethereum:${NATIVE}@43114`)).toBe('unsupported-network')
    })

    it.each([
        ['Ethereum', ETHEREUM],
        ['Base', BASE],
    ] as const)(
        'pays a link without a chain id on Ethereum when %s owns the scheme',
        (_label, owner) => {
            const owned = createEvmDeeplinkAdapter(owner)

            const result = owned.parse(`ethereum:${NATIVE}?value=1e18`)

            expect(result).toEqual({
                ok: true,
                intent: {
                    kind: 'payment',
                    target: { chainId: 'ethereum' },
                    recipient: NATIVE,
                    assetRef: { chainId: 'ethereum', assetId: 'native' },
                    amount: ONE_ETHER,
                },
            })
        },
    )

    describe('when Ethereum is not registered', () => {
        beforeEach(() => registerCodecs(BASE))

        it.each([
            `ethereum:${NATIVE}?value=1e18`,
            `ethereum:pay-${NATIVE}`,
            `ETHEREUM:${NATIVE}?value=1`,
            `ethereum:${TOKEN_LOWER}/transfer?address=${TO_LOWER}&uint256=1`,
            `ethereum:${NATIVE}@1?value=1e18`,
        ])('refuses %s as an unsupported network', input => {
            const owned = createEvmDeeplinkAdapter(BASE)

            const result = owned.parse(input)

            expect(result).toEqual({
                ok: false,
                reason: 'unsupported-network',
            })
        })

        it('still pays a link for @8453 on Base', () => {
            const owned = createEvmDeeplinkAdapter(BASE)

            const result = owned.parse(`ethereum:${NATIVE}@8453?value=1e18`)

            expect(result).toEqual({
                ok: true,
                intent: {
                    kind: 'payment',
                    target: { chainId: 'base', networkId: 'mainnet' },
                    recipient: NATIVE,
                    assetRef: { chainId: 'base', assetId: 'native' },
                    amount: ONE_ETHER,
                },
            })
        })
    })
})
