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
import { bytesToHex, keccak256 } from 'viem'
import type { Hex, TransactionSerializableEIP1559 } from 'viem'
import type {
    Signature,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'
import { transactionDigest } from '../digests'
import { ethereumPlannerAdapter } from '../planner'
import {
    SENDER,
    TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_2,
    createVectorKeyStore,
} from './fixtures'

const KEY_PAIR_ID = 'kms-entry-1'

const unsigned = (
    transaction: TransactionSerializableEIP1559,
    overrides?: Partial<UnsignedTransaction>,
): UnsignedTransaction => ({
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    payload: { from: SENDER, transaction },
    summary: {
        kind: 'transfer',
        title: { key: 'test' },
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
            const result = assemble(input, [signature({ bytes })])

            expect(requests).toEqual([
                {
                    requestIndex: 0,
                    signer: SENDER,
                    scheme: 'secp256k1',
                    payload: transactionDigest(transaction).digest,
                },
            ])
            expect(bytesToHex(result.bytes)).toBe(expected)
            expect(result.id).toBe(keccak256(expected as Hex))
            expect(result.scope).toEqual(input.scope)
        },
    )

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

        const result = assemble(unsigned(untyped), [signature({ bytes })])

        expect(request.payload).toEqual(plan(unsigned(TRANSFER))[0].payload)
        expect(bytesToHex(result.bytes)).toBe(VIEM_TRANSFER_NONCE_0)
    })

    it.each([
        ['a transaction for another network', { networkId: 'sepolia' }],
        ['an unknown network', { networkId: 'custom' }],
    ])('refuses %s', (_label, scope) => {
        const input = unsigned(TRANSFER, {
            scope: { chainId: 'ethereum', ...scope },
        })
        const message = `The transaction is for EIP-155 chain 1, not ${scope.networkId}`

        expect(() => plan(input)).toThrow(message)
        expect(() => assemble(input, [signature()])).toThrow(message)
    })

    it.each([
        [
            'another chain',
            { scope: { chainId: 'algorand', networkId: 'mainnet' } },
            'Not an Ethereum transaction: algorand/evm',
        ],
        [
            'another family',
            { chainData: { family: 'algorand' } },
            'Not an Ethereum transaction: ethereum/algorand',
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
            'The Ethereum transaction payload is malformed',
        )
    })

    it.each([
        ['no signatures', []],
        ['two signatures', [signature(), signature()]],
        ['another request index', [signature({ requestIndex: 1 })]],
        ['another signer', [signature({ signer: TRANSFER.to as string })]],
        ['another scheme', [signature({ scheme: 'ed25519' })]],
    ])('refuses %s', (_label, signatures) => {
        expect(() => assemble(unsigned(TRANSFER), signatures)).toThrow(
            'An Ethereum transaction takes exactly one secp256k1 signature, from its sender',
        )
    })

    it('rejects a 64-byte signature from the key store', () => {
        expect(() =>
            assemble(unsigned(TRANSFER), [
                signature({ bytes: new Uint8Array(64) }),
            ]),
        ).toThrow('The key store returned a malformed secp256k1 signature')
    })
})
