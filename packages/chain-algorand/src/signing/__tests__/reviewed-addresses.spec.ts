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
    toAlgorandNative,
    type AlgorandTransactionView,
} from '../../blockchain/models/transaction-view'
import { encodeAlgorandAddress } from '../../blockchain/utils/addresses'
import { algorandReviewedAddresses } from '../reviewed-addresses'

const keyOf = (seed: number) => new Uint8Array(32).fill(seed)
const addressOf = (seed: number) => encodeAlgorandAddress(keyOf(seed))

const SENDER = addressOf(1)
const RECEIVER = addressOf(2)
const CLOSE_TO = addressOf(3)
const NEW_AUTH = addressOf(4)
const REFERENCED = addressOf(5)

const reviewedOf = (view: Partial<AlgorandTransactionView>) =>
    algorandReviewedAddresses(
        toAlgorandNative({ sender: SENDER, fee: 1_000n, ...view }),
    )

describe('algorandReviewedAddresses', () => {
    it('names a payment receiver and the account its remainder closes to', () => {
        expect(
            reviewedOf({
                paymentTransaction: {
                    amount: 1n,
                    receiver: RECEIVER,
                    closeRemainderTo: CLOSE_TO,
                },
            }),
        ).toEqual([
            { address: RECEIVER, role: 'recipient' },
            { address: CLOSE_TO, role: 'close-recipient' },
        ])
    })

    it('names an asset receiver and the account its holding closes to', () => {
        expect(
            reviewedOf({
                assetTransferTransaction: {
                    amount: 1n,
                    assetId: 31566704n,
                    receiver: RECEIVER,
                    closeTo: CLOSE_TO,
                },
            }),
        ).toEqual([
            { address: RECEIVER, role: 'token-recipient' },
            { address: CLOSE_TO, role: 'close-recipient' },
        ])
    })

    it('names the account a clawback takes the asset from', () => {
        expect(
            reviewedOf({
                assetTransferTransaction: {
                    amount: 1n,
                    assetId: 31566704n,
                    receiver: RECEIVER,
                    sender: REFERENCED,
                },
            }),
        ).toEqual([
            { address: RECEIVER, role: 'token-recipient' },
            { address: REFERENCED, role: 'referenced-account' },
        ])
    })

    it('names every authority an asset configuration hands out', () => {
        expect(
            reviewedOf({
                assetConfigTransaction: {
                    assetId: 31566704n,
                    params: {
                        decimals: 6,
                        total: 1n,
                        manager: addressOf(6),
                        reserve: addressOf(7),
                        freeze: addressOf(8),
                        clawback: addressOf(9),
                    },
                },
            }),
        ).toEqual([
            { address: addressOf(6), role: 'new-authorizer' },
            { address: addressOf(7), role: 'new-authorizer' },
            { address: addressOf(8), role: 'new-authorizer' },
            { address: addressOf(9), role: 'new-authorizer' },
        ])
    })

    it('names the account an asset freeze targets', () => {
        expect(
            reviewedOf({
                assetFreezeTransaction: {
                    address: REFERENCED,
                    assetId: 31566704n,
                    newFreezeStatus: true,
                },
            }),
        ).toEqual([{ address: REFERENCED, role: 'referenced-account' }])
    })

    it('names the account a rekey hands signing to', () => {
        expect(
            reviewedOf({
                paymentTransaction: { amount: 0n, receiver: SENDER },
                rekeyTo: { publicKey: keyOf(4) },
            }),
        ).toContainEqual({ address: NEW_AUTH, role: 'new-authorizer' })
    })

    it('names the accounts an app call references', () => {
        expect(
            reviewedOf({
                applicationTransaction: {
                    applicationId: 1n,
                    accounts: [{ publicKey: keyOf(5) }],
                },
            }),
        ).toEqual([{ address: REFERENCED, role: 'referenced-account' }])
    })

    it('skips a key that is not an address', () => {
        expect(
            reviewedOf({ rekeyTo: { publicKey: new Uint8Array(3) } }),
        ).toEqual([])
    })

    it('names nothing for an app call with no accounts, and never the sender', () => {
        expect(
            reviewedOf({ applicationTransaction: { applicationId: 1n } }),
        ).toEqual([])
    })

    it('names nothing for another chain’s transaction', () => {
        expect(
            algorandReviewedAddresses({ family: 'evm', transaction: {} }),
        ).toEqual([])
    })
})
