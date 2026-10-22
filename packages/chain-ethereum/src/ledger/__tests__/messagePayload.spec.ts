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
import { concat, hashTypedData, keccak256 } from 'viem'
import type { TypedDataDefinition } from 'viem'
import {
    EIP2612_PERMIT_TYPED_DATA,
    MAIL_TYPED_DATA,
    SENDER,
} from '../../signing/__tests__/fixtures'
import {
    decodeEthereumLedgerMessage,
    encodeEthereumLedgerMessage,
    typedDataLedgerMessage,
} from '../messagePayload'

const mail = MAIL_TYPED_DATA as unknown as TypedDataDefinition

describe('Ethereum Ledger message payload', () => {
    it('round-trips a personal message', () => {
        const message = {
            kind: 'personal',
            message: '0x68656c6c6f',
            signer: SENDER,
        } as const

        expect(
            decodeEthereumLedgerMessage(encodeEthereumLedgerMessage(message)),
        ).toEqual(message)
    })

    it('round-trips typed data, with its domain separator and struct hash', () => {
        const message = { ...typedDataLedgerMessage(mail), signer: SENDER }

        expect(
            decodeEthereumLedgerMessage(encodeEthereumLedgerMessage(message)),
        ).toEqual(JSON.parse(JSON.stringify(message)))
    })

    it.each([
        ['Mail', mail],
        [
            'an EIP-2612 permit',
            EIP2612_PERMIT_TYPED_DATA as unknown as TypedDataDefinition,
        ],
    ])(
        'derives a domain separator and struct hash that hash to the EIP-712 digest of %s',
        (_name, typedData) => {
            const message = typedDataLedgerMessage(typedData)
            if (message.kind !== 'typedData') throw new Error('not typed data')

            expect(
                keccak256(
                    concat([
                        '0x1901',
                        message.domainSeparator,
                        message.structHash,
                    ]),
                ),
            ).toBe(hashTypedData(typedData))
        },
    )

    it('declares the EIP712Domain type the device needs to hash the domain', () => {
        const message = typedDataLedgerMessage(mail)
        if (message.kind !== 'typedData') throw new Error('not typed data')

        expect(message.typedData.types).toHaveProperty('EIP712Domain')
        expect(hashTypedData(message.typedData)).toBe(hashTypedData(mail))
    })

    it('hands the device a parsed domain chainId as the JSON number a dApp sends', () => {
        const parsed = {
            ...mail,
            domain: { ...mail.domain, chainId: 1n },
        } as TypedDataDefinition

        const decoded = decodeEthereumLedgerMessage(
            encodeEthereumLedgerMessage({
                ...typedDataLedgerMessage(parsed),
                signer: SENDER,
            }),
        )

        if (decoded.kind !== 'typedData') throw new Error('not typed data')
        expect(decoded.typedData.domain?.chainId).toBe(1)
        expect(hashTypedData(decoded.typedData)).toBe(hashTypedData(mail))
    })

    it('gives the device an empty domain for typed data that declares none', () => {
        const { domain: _domain, ...withoutDomain } = mail
        const typedData = withoutDomain as TypedDataDefinition

        const message = typedDataLedgerMessage(typedData)

        if (message.kind !== 'typedData') throw new Error('not typed data')
        expect(message.typedData.domain).toEqual({})
        expect(hashTypedData(message.typedData)).toBe(hashTypedData(typedData))
    })

    it('refuses bytes that are not an encoded Ethereum Ledger message', () => {
        const encode = (value: unknown) =>
            new TextEncoder().encode(JSON.stringify(value))

        expect(() =>
            decodeEthereumLedgerMessage(new Uint8Array([0xff])),
        ).toThrow()
        expect(() =>
            decodeEthereumLedgerMessage(encode({ kind: 'eth_sign' })),
        ).toThrow()
        expect(() =>
            decodeEthereumLedgerMessage(
                encode({ kind: 'personal', message: 'hello', signer: SENDER }),
            ),
        ).toThrow()
        expect(() =>
            decodeEthereumLedgerMessage(
                encode({ kind: 'personal', message: '0x68', signer: 'nobody' }),
            ),
        ).toThrow()
        expect(() =>
            decodeEthereumLedgerMessage(
                encode({ kind: 'typedData', typedData: {}, structHash: '0x' }),
            ),
        ).toThrow()
    })
})
