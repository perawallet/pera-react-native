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

// Self-tests the cast oracle against published vectors. It tests no app code:
// if these fail, every parity comparison that uses cast is meaningless.

import { getAddress } from 'viem'
import { beforeAll, describe, expect, it } from 'vitest'

import {
    ANVIL_DEV_MNEMONIC_VECTOR,
    EIP155_SIGNING_VECTOR,
    EIP712_MAIL_VECTOR,
    EIP55_VECTORS,
} from '../../vectors/knownAnswerVectors'
import {
    castAddressFromMnemonic,
    castAddressFromPrivateKey,
    castCalldata,
    castChecksumAddress,
    castDecodeTransaction,
    castMktx,
    castPrivateKeyFromMnemonic,
    castSignMessage,
    castSignTypedData,
    castVerifyMessage,
    isCastAvailable,
} from '../cast'

const V = ANVIL_DEV_MNEMONIC_VECTOR

describe('cast oracle', () => {
    beforeAll(async () => {
        expect(await isCastAvailable()).toBe(true)
    })

    it('derives the published Anvil dev addresses from the mnemonic', async () => {
        expect(
            await castAddressFromMnemonic({ mnemonic: V.mnemonic, index: 0 }),
        ).toBe(V.addresses[0])
        expect(
            await castAddressFromMnemonic({ mnemonic: V.mnemonic, index: 1 }),
        ).toBe(V.addresses[1])
    })

    it('honours the account segment of the derivation path', async () => {
        const first = await castAddressFromMnemonic({ mnemonic: V.mnemonic })
        const otherAccount = await castAddressFromMnemonic({
            mnemonic: V.mnemonic,
            account: 1,
        })

        expect(first).toBe(V.addresses[0])
        expect(otherAccount).not.toBe(first)
    })

    it('round-trips a derived private key back to its address', async () => {
        const key = await castPrivateKeyFromMnemonic({
            mnemonic: V.mnemonic,
            index: 1,
        })

        expect(key).toBe(V.privateKeys[1])
        expect(await castAddressFromPrivateKey(key)).toBe(V.addresses[1])
    })

    it.each(EIP55_VECTORS)(
        'cast checksums %s as published in EIP-55',
        async vector => {
            expect(await castChecksumAddress(vector.toLowerCase())).toBe(vector)
        },
    )

    it.each(EIP55_VECTORS)(
        'viem agrees with the EIP-55 vector %s (cross-check only, not the oracle)',
        vector => {
            expect(getAddress(vector.toLowerCase())).toBe(vector)
        },
    )

    it('signs the EIP-712 Mail example to the published v, r and s', async () => {
        const v = EIP712_MAIL_VECTOR

        const signature = await castSignTypedData({
            privateKey: v.privateKey,
            typedData: v.typedData,
        })

        expect(await castAddressFromPrivateKey(v.privateKey)).toBe(v.address)
        expect(signature).toBe(`${v.r}${v.s.slice(2)}${v.v.toString(16)}`)
    })

    it('reproduces the signed legacy transaction published in EIP-155', async () => {
        const v = EIP155_SIGNING_VECTOR

        const raw = await castMktx({
            privateKey: v.privateKey,
            chainId: v.chainId,
            nonce: v.nonce,
            to: v.to,
            value: v.value,
            gas: v.gas,
            maxFeePerGas: v.gasPrice,
            legacy: true,
        })

        expect(raw).toBe(v.signedRlp)
    })

    it('encodes an EIP-1559 transaction whose decoded fields equal the inputs', async () => {
        const raw = await castMktx({
            privateKey: V.privateKeys[0],
            chain: 'base',
            nonce: 7,
            to: V.addresses[1],
            value: 123_456_789_012_345_678_901n,
            data: '0xdeadbeef',
            gas: 90_000n,
            maxFeePerGas: 3_000_000_000n,
            maxPriorityFeePerGas: 1_500_000_000n,
        })

        const decoded = await castDecodeTransaction(raw)

        expect(decoded).toMatchObject({
            type: '0x2',
            signer: V.addresses[0].toLowerCase(),
            chainId: '0x14a34',
            nonce: '0x7',
            to: V.addresses[1].toLowerCase(),
            value: '0x' + 123_456_789_012_345_678_901n.toString(16),
            input: '0xdeadbeef',
            gas: '0x' + (90_000).toString(16),
            maxFeePerGas: '0x' + (3_000_000_000).toString(16),
            maxPriorityFeePerGas: '0x' + (1_500_000_000).toString(16),
        })
    })

    it('signs an EIP-191 message that recovers to the signer', async () => {
        const signature = await castSignMessage({
            privateKey: V.privateKeys[0],
            message: 'hello',
        })

        expect(
            await castVerifyMessage({
                address: V.addresses[0],
                message: 'hello',
                signature,
            }),
        ).toBe(true)
        expect(
            await castVerifyMessage({
                address: V.addresses[1],
                message: 'hello',
                signature,
            }),
        ).toBe(false)
    })

    it('treats 0x-prefixed message input as raw bytes', async () => {
        const asText = await castSignMessage({
            privateKey: V.privateKeys[0],
            message: 'hello',
        })
        const asBytes = await castSignMessage({
            privateKey: V.privateKeys[0],
            message: '0x68656c6c6f',
        })

        expect(asBytes).toBe(asText)
    })

    it('signs EIP-712 typed data deterministically', async () => {
        const typedData = {
            types: {
                EIP712Domain: [{ name: 'name', type: 'string' }],
                Note: [{ name: 'text', type: 'string' }],
            },
            primaryType: 'Note',
            domain: { name: 'Conformance' },
            message: { text: 'hi' },
        }

        const first = await castSignTypedData({
            privateKey: V.privateKeys[0],
            typedData,
        })
        const second = await castSignTypedData({
            privateKey: V.privateKeys[0],
            typedData,
        })

        expect(first).toMatch(/^0x[0-9a-f]{130}$/)
        expect(second).toBe(first)
    })

    it('encodes an ERC-20 transfer under the published selector', async () => {
        const data = await castCalldata('transfer(address,uint256)', [
            V.addresses[1],
            '1',
        ])
        expect(data.slice(0, 10)).toBe('0xa9059cbb')
        expect(data).toHaveLength(10 + 128)
    })
})
