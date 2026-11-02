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
import { maxUint256, stringToHex } from 'viem'
import {
    DAI_PERMIT_TYPED_DATA,
    EIP2612_PERMIT_TYPED_DATA,
    ERC721_PERMIT_TYPED_DATA,
    MAIL_TYPED_DATA,
    PERMIT2_SINGLE_TYPED_DATA,
    SENDER,
} from '../../signing/__tests__/fixtures'
import {
    MAX_MESSAGE_LENGTH,
    MAX_TYPED_DATA_DEPTH,
    MAX_TYPED_DATA_NODES,
    validateEthereumMessagePayload,
} from '../messageParams'
import { ETHEREUM_WC_V2_METHOD } from '../walletConnect'

const LOWERCASE_SENDER = SENDER.toLowerCase()
const OTHER = '0x0000000000000000000000000000000000000001'

const validate = (
    type: 'sign-message' | 'sign-typed-data',
    params: unknown,
    authorizedAccounts: readonly string[] = [SENDER],
    session: { eip155ChainId: number | undefined } = { eip155ChainId: 1 },
) => validateEthereumMessagePayload(type, params, authorizedAccounts, session)

describe('validateEthereumMessagePayload: personal_sign', () => {
    it('reads [message, address]', () => {
        const result = validate('sign-message', ['0x68656c6c6f', SENDER])

        expect(result).toEqual({
            ok: true,
            request: {
                method: ETHEREUM_WC_V2_METHOD.personalSign,
                signer: SENDER,
                payload: { message: '0x68656c6c6f' },
            },
        })
    })

    it('signs a plain-text message as its UTF-8 bytes', () => {
        const result = validate('sign-message', ['hello world', SENDER])

        expect(result).toMatchObject({
            ok: true,
            request: { payload: { message: stringToHex('hello world') } },
        })
    })

    it('signs odd-length hex as text, since it is not whole bytes', () => {
        const result = validate('sign-message', ['0xabc', SENDER])

        expect(result).toMatchObject({
            ok: true,
            request: { payload: { message: stringToHex('0xabc') } },
        })
    })

    it('refuses the swapped order [address, message]', () => {
        const result = validate('sign-message', [SENDER, 'hello world'])

        expect(result.ok).toBe(false)
    })

    it('hands the signer back checksummed', () => {
        const result = validate('sign-message', [
            '0x68656c6c6f',
            LOWERCASE_SENDER,
        ])

        expect(result).toMatchObject({ ok: true, request: { signer: SENDER } })
    })

    it.each([
        ['a missing address', ['0x68656c6c6f']],
        ['a malformed address', ['0x68656c6c6f', '0x1234']],
        ['a non-string message', [42, SENDER]],
        ['no params at all', []],
    ])('refuses %s', (_label, params) => {
        expect(validate('sign-message', params).ok).toBe(false)
    })

    it('refuses params that are not an array', () => {
        expect(
            validate('sign-message', {
                message: 'x',
                address: SENDER,
            }).ok,
        ).toBe(false)
    })
})

describe('validateEthereumMessagePayload: eth_signTypedData_v4', () => {
    it('reads [address, typedData] with the typed data as a JSON string', () => {
        const result = validate('sign-typed-data', [
            SENDER,
            JSON.stringify(MAIL_TYPED_DATA),
        ])

        expect(result).toEqual({
            ok: true,
            request: {
                method: ETHEREUM_WC_V2_METHOD.signTypedDataV4,
                signer: SENDER,
                payload: { typedData: MAIL_TYPED_DATA },
            },
        })
    })

    it('takes the typed data as an object too', () => {
        const result = validate('sign-typed-data', [SENDER, MAIL_TYPED_DATA])

        expect(result).toMatchObject({
            ok: true,
            request: { payload: { typedData: MAIL_TYPED_DATA } },
        })
    })

    it('refuses the swapped order [typedData, address]', () => {
        const result = validate('sign-typed-data', [
            JSON.stringify(MAIL_TYPED_DATA),
            SENDER,
        ])

        expect(result.ok).toBe(false)
    })

    it('hands the signer back checksummed', () => {
        const result = validate('sign-typed-data', [
            LOWERCASE_SENDER,
            MAIL_TYPED_DATA,
        ])

        expect(result).toMatchObject({ ok: true, request: { signer: SENDER } })
    })

    it.each([
        ['invalid JSON', [SENDER, '{not json']],
        ['a JSON array', [SENDER, '[1, 2]']],
        ['a JSON scalar', [SENDER, '"text"']],
        ['a missing address', [undefined, MAIL_TYPED_DATA]],
        ['a malformed address', ['nope', MAIL_TYPED_DATA]],
    ])('refuses %s', (_label, params) => {
        expect(validate('sign-typed-data', params).ok).toBe(false)
    })
})

describe('validateEthereumMessagePayload: typed-data chain', () => {
    const SEPOLIA = { eip155ChainId: 11155111 }
    const withChainId = (chainId: unknown) => ({
        ...MAIL_TYPED_DATA,
        domain: { ...MAIL_TYPED_DATA.domain, chainId },
    })

    it.each([[11155111], ['11155111'], ['0xaa36a7']])(
        'accepts a typed-data domain chainId given as %s',
        chainId => {
            const result = validate(
                'sign-typed-data',
                [SENDER, withChainId(chainId)],
                [SENDER],
                SEPOLIA,
            )

            expect(result.ok).toBe(true)
        },
    )

    it('refuses typed data bound to another chain', () => {
        const result = validate(
            'sign-typed-data',
            [SENDER, withChainId(1)],
            [SENDER],
            SEPOLIA,
        )

        expect(result).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it('refuses a domain chainId that is not a chain id', () => {
        const result = validate(
            'sign-typed-data',
            [SENDER, withChainId('mainnet')],
            [SENDER],
            SEPOLIA,
        )

        expect(result).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it('accepts typed data with no domain chainId', () => {
        const { chainId: _chainId, ...domain } = MAIL_TYPED_DATA.domain

        const result = validate(
            'sign-typed-data',
            [SENDER, { ...MAIL_TYPED_DATA, domain }],
            [SENDER],
            SEPOLIA,
        )

        expect(result.ok).toBe(true)
    })

    it.each([
        ['an EIP-2612 permit', EIP2612_PERMIT_TYPED_DATA],
        ['a Permit2 permit', PERMIT2_SINGLE_TYPED_DATA],
        ['a DAI-style permit', DAI_PERMIT_TYPED_DATA],
        [
            'a DAI-style permit that revokes',
            {
                ...DAI_PERMIT_TYPED_DATA,
                message: { ...DAI_PERMIT_TYPED_DATA.message, allowed: false },
            },
        ],
        ['an ERC-721 permit', ERC721_PERMIT_TYPED_DATA],
        [
            'an ERC-721 permit with a token id past uint256',
            {
                ...ERC721_PERMIT_TYPED_DATA,
                message: {
                    ...ERC721_PERMIT_TYPED_DATA.message,
                    tokenId: (maxUint256 + 1n).toString(),
                },
            },
        ],
    ])('refuses %s with no domain chainId', (_name, permit) => {
        const { chainId: _chainId, ...domain } = permit.domain

        const result = validate('sign-typed-data', [
            SENDER,
            { ...permit, domain },
        ])

        expect(result).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it.each([
        ['an EIP-2612 permit', EIP2612_PERMIT_TYPED_DATA],
        ['a DAI-style permit', DAI_PERMIT_TYPED_DATA],
        ['an ERC-721 permit', ERC721_PERMIT_TYPED_DATA],
    ])('accepts %s bound to the connected chain', (_name, permit) => {
        expect(validate('sign-typed-data', [SENDER, permit]).ok).toBe(true)
    })

    it('refuses typed data with a chainId when the network has no EIP-155 id', () => {
        const result = validate(
            'sign-typed-data',
            [SENDER, withChainId(1)],
            [SENDER],
            { eip155ChainId: undefined },
        )

        expect(result.ok).toBe(false)
    })
})

describe('validateEthereumMessagePayload: session accounts', () => {
    it.each([
        ['sign-message', ['0x68656c6c6f', SENDER]],
        ['sign-typed-data', [SENDER, MAIL_TYPED_DATA]],
    ] as const)(
        'refuses a %s signer outside the session as unauthorized-account',
        (type, params) => {
            expect(validate(type, params, [OTHER])).toMatchObject({
                ok: false,
                failure: 'unauthorized-account',
            })
        },
    )

    it('matches a lowercase session account to a checksummed signer', () => {
        expect(
            validate(
                'sign-message',
                ['0x68656c6c6f', SENDER],
                [LOWERCASE_SENDER],
            ).ok,
        ).toBe(true)
    })
})

describe('validateEthereumMessagePayload: size caps', () => {
    const nested = (depth: number): unknown =>
        depth === 0 ? 'leaf' : { child: nested(depth - 1) }

    it('refuses a personal_sign message over the length cap', () => {
        expect(
            validate('sign-message', [
                'a'.repeat(MAX_MESSAGE_LENGTH + 1),
                SENDER,
            ]),
        ).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it('refuses typed data whose JSON is over the length cap, before parsing it', () => {
        expect(
            validate('sign-typed-data', [
                SENDER,
                JSON.stringify({
                    ...MAIL_TYPED_DATA,
                    pad: 'a'.repeat(MAX_MESSAGE_LENGTH),
                }),
            ]),
        ).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it('refuses a typed-data object over the node budget', () => {
        const typedData = {
            ...MAIL_TYPED_DATA,
            message: {
                items: Array.from({ length: MAX_TYPED_DATA_NODES }, () => 1),
            },
        }

        expect(validate('sign-typed-data', [SENDER, typedData])).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })

    it('refuses typed data nested past the depth cap', () => {
        const typedData = {
            ...MAIL_TYPED_DATA,
            message: nested(MAX_TYPED_DATA_DEPTH),
        }

        expect(validate('sign-typed-data', [SENDER, typedData])).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })
})
