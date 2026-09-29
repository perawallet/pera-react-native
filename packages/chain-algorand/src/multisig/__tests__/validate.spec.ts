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
import {
    encodeAddress,
    encodeUnsignedTransaction,
    makePaymentTxnWithSuggestedParamsFromObject,
} from 'algosdk'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { generateMultisigAddress } from '../address'
import { validateAlgorandSignRequest } from '../validate'

const addressOf = (fill: number) => encodeAddress(new Uint8Array(32).fill(fill))

const PARTICIPANTS = [addressOf(1), addressOf(2), addressOf(3)]
const JOINT = generateMultisigAddress(1, 2, PARTICIPANTS)
const REKEYED = addressOf(7)

const rawPaymentFrom = (sender: string): string =>
    encodeToBase64(
        encodeUnsignedTransaction(
            makePaymentTxnWithSuggestedParamsFromObject({
                sender,
                receiver: sender,
                amount: 1n,
                suggestedParams: {
                    fee: 1000n,
                    minFee: 1000n,
                    firstValid: 1n,
                    lastValid: 1001n,
                    genesisID: 'testnet-v1.0',
                    genesisHash: new Uint8Array(32).fill(9),
                },
            }),
        ),
    )

const signRequest = (
    rawTransactions: string[],
    address = JOINT,
): MultisigSignRequest => ({
    id: 'sr-1',
    status: 'pending',
    type: 'async',
    createdAt: new Date(0),
    expectedExpireDatetime: new Date(0),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: {
        customId: 'm-1',
        createdAt: new Date(0),
        address,
        version: 1,
        threshold: 2,
        participantAddresses: PARTICIPANTS,
    },
    transactionLists: [
        {
            id: 'tl-1',
            rawTransactions,
            firstValidBlock: 1,
            lastValidBlock: 1001,
            expectedExpireDatetime: new Date(0),
            responses: [],
        },
    ],
})

describe('validateAlgorandSignRequest', () => {
    it('accepts transactions sent by the joint account or an authorized rekeyed sender', () => {
        const result = validateAlgorandSignRequest(
            signRequest([rawPaymentFrom(JOINT), rawPaymentFrom(REKEYED)]),
            new Set([JOINT, REKEYED]),
        )

        expect(result).toEqual({ kind: 'valid' })
    })

    it("rejects a transaction sent by the co-signer's own address (standalone-single-sig drain)", () => {
        const result = validateAlgorandSignRequest(
            signRequest([
                rawPaymentFrom(JOINT),
                rawPaymentFrom(PARTICIPANTS[0]),
            ]),
            new Set([JOINT]),
        )

        expect(result).toEqual({ kind: 'unauthorized-sender', txIndex: 1 })
    })

    it('fails closed on a transaction that does not decode', () => {
        const result = validateAlgorandSignRequest(
            signRequest([encodeToBase64(new Uint8Array([0xc1]))]),
            new Set([JOINT]),
        )

        expect(result).toEqual({ kind: 'unauthorized-sender', txIndex: 0 })
    })

    it("rejects a joint address that isn't the msig hash of its participants", () => {
        // A participant's personal address dressed up as the joint account
        // would otherwise make the sender allowlist vacuous.
        const result = validateAlgorandSignRequest(
            signRequest([rawPaymentFrom(PARTICIPANTS[0])], PARTICIPANTS[0]),
            new Set([PARTICIPANTS[0]]),
        )

        expect(result).toEqual({ kind: 'address-mismatch' })
    })

    it('reports a request with no transaction lists', () => {
        const result = validateAlgorandSignRequest(
            { ...signRequest([]), transactionLists: [] },
            new Set([JOINT]),
        )

        expect(result).toEqual({ kind: 'no-transactions' })
    })
})
