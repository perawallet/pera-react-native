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
import { bytesToHex, hexToBytes, keccak256, serializeTransaction } from 'viem'
import type { Hex, TransactionSerializableEIP1559 } from 'viem'
import {
    i18nKey,
    type Signature,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'
import { UnknownEvmNetworkError } from '../../blockchain/utils/caip19'
import { transactionDigest } from '../digests'
import { createEvmPlannerAdapter } from '../adapter'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'

const ethereumPlannerAdapter = createEvmPlannerAdapter(ETHEREUM)
import {
    SENDER,
    TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_2,
    createVectorKeyStore,
} from './fixtures'

const KEY_PAIR_ID = 'kms-entry-1'

// `cast wallet sign --no-hash` with the throwaway key 0x11…11 over TRANSFER's
// digest, recovery byte rewritten from 27 to the key store's 0. Precomputed
// because the package may import no secp256k1 library, test code included.
const TRANSFER_DIGEST =
    '0x82afed965c7aa87b5689c5eb049f2b77e23ae7819f6e081b8a3198c1ed5195f8'
const THROWAWAY_ADDRESS = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A'
const THROWAWAY_SIGNATURE =
    '0x764d939f4b88606c6685952521906ff0363c6852c1fe2f9d6304119e891a8ec5679ab442427e23a613c49055a2654ee5957443031d6e1e85dc922e8d3083888000'

const unsigned = (
    transaction: TransactionSerializableEIP1559,
    overrides?: Partial<UnsignedTransaction>,
): UnsignedTransaction => ({
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    payload: { from: SENDER, transaction },
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
    ...overrides,
})

const signature = (overrides?: Partial<Signature>): Signature => ({
    requestIndex: 0,
    signer: SENDER,
    scheme: 'secp256k1',
    bytes: new Uint8Array(65),
    ...overrides,
})

const { plan, assemble } = ethereumPlannerAdapter

describe('ethereumPlannerAdapter', () => {
    it.each([
        [TRANSFER, VIEM_TRANSFER_NONCE_0],
        [{ ...TRANSFER, nonce: 2 }, VIEM_TRANSFER_NONCE_2],
    ])(
        'plans and assembles what viem signTransaction produces for %#',
        async (transaction, expected) => {
            const input = unsigned(transaction)

            const requests = plan(input)
            const { kms } = createVectorKeyStore()
            const bytes = await kms.sign(
                KEY_PAIR_ID,
                requests[0].payload,
                SIGNING_ACCESS_DOMAIN,
            )
            const result = await assemble(input, [signature({ bytes })])

            expect(requests).toEqual([
                {
                    requestIndex: 0,
                    signer: SENDER,
                    scheme: 'secp256k1',
                    payload: transactionDigest(transaction).digest,
                    devicePayload: hexToBytes(
                        serializeTransaction({
                            ...transaction,
                            type: 'eip1559',
                        }),
                    ),
                },
            ])
            expect(bytesToHex(result.bytes)).toBe(expected)
            expect(result.id).toBe(keccak256(expected as Hex))
            expect(result.scope).toEqual(input.scope)
        },
    )

    it("refuses another key's signature labelled as the sender's", async () => {
        const input = unsigned(TRANSFER)
        const [request] = plan(input)
        const bytes = hexToBytes(THROWAWAY_SIGNATURE)

        expect(bytesToHex(request.payload)).toBe(TRANSFER_DIGEST)
        await expect(assemble(input, [signature({ bytes })])).rejects.toThrow(
            `The signature recovers to ${THROWAWAY_ADDRESS}, not the sender ${SENDER}`,
        )
    })

    it('plans a payload without a priority fee, which defaults to 0', () => {
        const { maxPriorityFeePerGas: _omitted, ...unpriorited } = TRANSFER

        expect(plan(unsigned(unpriorited))).toHaveLength(1)
    })

    it('gives a device the unsigned EIP-2718 serialization, which hashes to the digest the key signs', () => {
        const [request] = plan(unsigned(TRANSFER))

        expect(request.devicePayload?.[0]).toBe(0x02)
        expect(
            keccak256(request.devicePayload ?? new Uint8Array(), 'bytes'),
        ).toEqual(request.payload)
    })

    it('checksums a lowercase sender', () => {
        const input = unsigned(TRANSFER, {
            payload: {
                from: SENDER.toLowerCase(),
                transaction: TRANSFER,
            },
        })

        expect(plan(input)[0].signer).toBe(SENDER)
    })

    it('treats a missing type as EIP-1559', async () => {
        const { type: _type, ...untyped } = TRANSFER
        const { kms } = createVectorKeyStore()
        const request = plan(unsigned(untyped))[0]
        const bytes = await kms.sign(
            KEY_PAIR_ID,
            request.payload,
            SIGNING_ACCESS_DOMAIN,
        )

        const result = await assemble(unsigned(untyped), [signature({ bytes })])

        expect(request.payload).toEqual(plan(unsigned(TRANSFER))[0].payload)
        expect(bytesToHex(result.bytes)).toBe(VIEM_TRANSFER_NONCE_0)
    })

    it('refuses a transaction for another network', async () => {
        const input = unsigned(TRANSFER, {
            scope: { chainId: 'ethereum', networkId: 'sepolia' },
        })
        const message = 'The transaction is for EIP-155 chain 1, not sepolia'

        expect(() => plan(input)).toThrow(message)
        await expect(assemble(input, [signature()])).rejects.toThrow(message)
    })

    it('refuses an unknown network', async () => {
        const input = unsigned(TRANSFER, {
            scope: { chainId: 'ethereum', networkId: 'custom' },
        })

        expect(() => plan(input)).toThrow(UnknownEvmNetworkError)
        await expect(assemble(input, [signature()])).rejects.toThrow(
            UnknownEvmNetworkError,
        )
    })

    it.each([
        [
            'another chain',
            { scope: { chainId: 'algorand', networkId: 'mainnet' } },
            'Not a transaction for Ethereum: algorand/evm',
        ],
        [
            'another family',
            { chainData: { family: 'algorand' } },
            'Not a transaction for Ethereum: ethereum/algorand',
        ],
    ] as const)('refuses %s', (_label, overrides, message) => {
        const input = unsigned(TRANSFER, overrides as never)

        expect(() => plan(input)).toThrow(message)
    })

    it.each([
        ['a malformed sender', { from: '0x123', transaction: TRANSFER }],
        ['no payload', null],
        [
            'a legacy transaction',
            { from: SENDER, transaction: { ...TRANSFER, type: 'legacy' } },
        ],
    ])('refuses %s', (_label, payload) => {
        const input = unsigned(TRANSFER, { payload })

        expect(() => plan(input)).toThrow(
            'The EVM transaction payload is malformed',
        )
    })

    it.each([
        ['nonce', 'nonce'],
        ['gas limit', 'gas'],
        ['max fee per gas', 'maxFeePerGas'],
    ] as const)(
        'refuses to plan or assemble without a %s',
        async (_label, field) => {
            const { [field]: _omitted, ...incomplete } = TRANSFER
            const input = unsigned(incomplete)
            const message =
                'The EVM transaction needs a nonce, a gas limit and a max fee per gas to be signed'

            expect(() => plan(input)).toThrow(message)
            await expect(assemble(input, [signature()])).rejects.toThrow(
                message,
            )
        },
    )

    it.each([
        ['no signatures', []],
        ['two signatures', [signature(), signature()]],
        ['another request index', [signature({ requestIndex: 1 })]],
        ['another signer', [signature({ signer: TRANSFER.to as string })]],
        ['another scheme', [signature({ scheme: 'ed25519' })]],
    ])('refuses %s', async (_label, signatures) => {
        await expect(assemble(unsigned(TRANSFER), signatures)).rejects.toThrow(
            'An EVM transaction takes exactly one secp256k1 signature, from its sender',
        )
    })

    it('rejects a 64-byte signature from the key store', async () => {
        await expect(
            assemble(unsigned(TRANSFER), [
                signature({ bytes: new Uint8Array(64) }),
            ]),
        ).rejects.toThrow(
            'The key store returned a malformed secp256k1 signature',
        )
    })
})

describe('the Base planner', () => {
    const base = createEvmPlannerAdapter(BASE)
    const onBase = (chainId: number) =>
        unsigned(
            { ...TRANSFER, chainId },
            { scope: { chainId: 'base', networkId: 'mainnet' } },
        )

    it('plans a transaction for its own EIP-155 id', () => {
        expect(base.plan(onBase(8453))).toHaveLength(1)
    })

    it("refuses a payload whose chain id isn't its scope's", () => {
        expect(() => base.plan(onBase(1))).toThrow(
            'The transaction is for EIP-155 chain 1, not mainnet',
        )
    })

    it("refuses another chain's scope", () => {
        expect(() => base.plan(unsigned(TRANSFER))).toThrow(
            'Not a transaction for Base: ethereum/evm',
        )
    })
})
