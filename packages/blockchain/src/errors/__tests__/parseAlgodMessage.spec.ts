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

import { describe, test, expect } from 'vitest'
import { parseAlgodMessage } from '../parseAlgodMessage'
import { AlgodErrorCode } from '../algodErrorCodes'

const ADDR = 'GBFKIKHL55YJRTB4PSWXWQJDPHG6IHOLESWSWPPPR6HQ2N7H76RBI5JIT4'
const TXID = 'X4CQTNNARMMELORLYBJY27776Z2453LLREFIZKJYVE3B5FJSL7HA'

describe('parseAlgodMessage', () => {
    describe('overspend', () => {
        test('parses the PERA-4038 overspend error from a real node response', () => {
            // Full message copied verbatim from an algod rejection.
            const message =
                `TransactionPool.Remember: transaction ${TXID}: ` +
                `overspend (account ${ADDR}, data {AccountBaseData:{Status:Offline ` +
                `MicroAlgos:{Raw:199000} RewardsBase:218288 RewardedMicroAlgos:{Raw:0} ` +
                `AuthAddr:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ ` +
                `IncentiveEligible:false TotalAppSchema:{NumUint:0 NumByteSlice:0} ` +
                `TotalExtraAppPages:0 TotalAppParams:0 TotalAppLocalStates:0 ` +
                `TotalAssetParams:0 TotalAssets:1 TotalBoxes:0 TotalBoxBytes:0 ` +
                `LastProposed:0 LastHeartbeat:0}}, tried to spend {201000})`

            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.OVERSPEND,
                params: {
                    address: ADDR,
                    balance: 199000n,
                    spent: 201000n,
                    missing: 2000n,
                },
            })
        })

        test('sets missing=0 when spent equals balance (edge case)', () => {
            const message = `overspend (account ${ADDR}, data {AccountBaseData:{MicroAlgos:{Raw:1000}}}, tried to spend {1000})`
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.OVERSPEND,
                params: {
                    address: ADDR,
                    balance: 1000n,
                    spent: 1000n,
                    missing: 0n,
                },
            })
        })
    })

    describe('below_min_balance', () => {
        test('parses balance-below-min with asset count', () => {
            const message = `TransactionPool.Remember: account ${ADDR} balance 199000 below min 200000 (1 assets)`
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.BELOW_MIN_BALANCE,
                params: {
                    address: ADDR,
                    balance: 199000n,
                    required: 200000n,
                    assetCount: 1,
                },
            })
        })

        test('parses balance-below-min without asset count', () => {
            const message = `account ${ADDR} balance 50000 below min 100000`
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.BELOW_MIN_BALANCE,
                params: {
                    address: ADDR,
                    balance: 50000n,
                    required: 100000n,
                },
            })
        })
    })

    describe('missing_opt_in', () => {
        test('parses asset-missing-from-account', () => {
            const message = `TransactionPool.Remember: transaction ${TXID}: asset 31566704 missing from ${ADDR}`
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.MISSING_OPT_IN,
                params: {
                    address: ADDR,
                    assetId: 31566704n,
                },
            })
        })
    })

    describe('duplicate_txn', () => {
        test('parses transaction-already-in-ledger', () => {
            const message = `TransactionPool.Remember: transaction already in ledger: ${TXID}`
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.DUPLICATE_TXN,
                params: { txId: TXID },
            })
        })
    })

    describe('expired_txn', () => {
        test('parses txn-dead validity-window error', () => {
            const message =
                'TransactionPool.Remember: txn dead: round 50000000 outside of 49999000-49999999'
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.EXPIRED_TXN,
                params: {
                    currentRound: 50000000n,
                    lastValid: 49999999n,
                },
            })
        })
    })

    describe('not_authorized', () => {
        const AUTH_ADDR =
            'PNVR2DIQNNCRVQFVVIVOZH4LWDOYRERK7VIQEWTUYAJRTLNLZY2M2SUENM'

        test('parses the wrong-auth-key rejection (stale rekey)', () => {
            const message =
                `TransactionPool.Remember: transaction ${TXID}: ` +
                `should have been authorized by ${AUTH_ADDR} ` +
                `but was actually authorized by ${ADDR}`
            expect(parseAlgodMessage(message)).toEqual({
                code: 'not_authorized',
                params: {
                    expectedAuthAddress: AUTH_ADDR,
                    actualAuthAddress: ADDR,
                },
            })
        })

        test('parses the rejection when wrapped by a transport-layer prefix', () => {
            const message =
                `Transport failed: transaction ${TXID}: ` +
                `should have been authorized by ${AUTH_ADDR} ` +
                `but was actually authorized by ${ADDR}`
            expect(parseAlgodMessage(message)?.code).toBe('not_authorized')
        })
    })

    describe('unknown', () => {
        test('returns null for a message that matches nothing', () => {
            expect(
                parseAlgodMessage('something completely unrelated'),
            ).toBeNull()
        })

        test('returns null for empty string', () => {
            expect(parseAlgodMessage('')).toBeNull()
        })
    })
})
