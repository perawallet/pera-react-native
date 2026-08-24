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
        // PERA-4908: go-algorand has shipped at least two incompatible
        // renderings of the balance/spend figures inside this message, and
        // the newer one also folds in an un-recoverable fee subtraction (see
        // `algodErrorCodes.ts`'s `overspend.balance` doc). Every case here
        // asserts classification + address only — no numeric params — since
        // that is now deliberately all `matchOverspend` extracts.
        test('parses the legacy PERA-4038 raw-struct rendering', () => {
            // Full message copied verbatim from an algod rejection (older
            // go-algorand build).
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
                params: { address: ADDR },
            })
        })

        test('parses algod 5.0.0-stable rendering with a non-round mA balance', () => {
            // Verbatim from a real LocalNet rejection (funded 300_777 µAlgo,
            // fee 1000, spend 50_000_000 µAlgo): the node subtracts the fee
            // before display (300_777 - 1000 = 299_777 = "299.777mA") and
            // renders the requested spend in whole Algo ("50A").
            const message =
                `TransactionPool.Remember: transaction ${TXID}: ` +
                `overspend (account ${ADDR}, data {AccountBaseData:{Status:Offline ` +
                `MicroAlgos:299.777mA RewardsBase:0 RewardedMicroAlgos:0.0A ` +
                `AuthAddr:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ}}, ` +
                `tried to spend 50A)`

            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.OVERSPEND,
                params: { address: ADDR },
            })
        })

        test('parses algod 5.0.0-stable rendering with the A-suffix (>= 1 Algo) variant', () => {
            // Verbatim from a real LocalNet rejection (funded 1_234_567
            // µAlgo, fee 1000, spend 50_000_000 µAlgo):
            // 1_234_567 - 1000 = 1_233_567 µAlgo = "1.233567A".
            const message =
                `overspend (account ${ADDR}, data {AccountBaseData:{Status:Offline ` +
                `MicroAlgos:1.233567A RewardsBase:0}}, tried to spend 50A)`

            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.OVERSPEND,
                params: { address: ADDR },
            })
        })

        test('parses a round mA balance with no decimal part', () => {
            // Verbatim from a real LocalNet rejection: a whole-milliAlgo
            // balance renders with neither a decimal point nor trailing
            // zeros ("299mA", not "299.000mA").
            const message =
                `overspend (account ${ADDR}, data {AccountBaseData:{Status:Offline ` +
                `MicroAlgos:299mA RewardsBase:0}}, tried to spend 900mA)`

            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.OVERSPEND,
                params: { address: ADDR },
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

    describe('asset_frozen', () => {
        test('parses asset-frozen-in-account', () => {
            const message = `TransactionPool.Remember: transaction ${TXID}: asset 98655914 frozen in ${ADDR}`
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.ASSET_FROZEN,
                params: {
                    address: ADDR,
                    assetId: 98655914n,
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
        test('parses txn-dead validity-window error (single dash)', () => {
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

        test("parses algod 5.0.0-stable's double-dash rendering", () => {
            // Verbatim from a real LocalNet rejection.
            const message =
                'TransactionPool.Remember: txn dead: round 1681 outside of 1670--1675'
            expect(parseAlgodMessage(message)).toEqual({
                code: AlgodErrorCode.EXPIRED_TXN,
                params: {
                    currentRound: 1681n,
                    lastValid: 1675n,
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

    describe('logic eval error', () => {
        test('parses an app-call logic eval rejection', () => {
            const msg =
                'TransactionPool.Remember: transaction ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQR23: logic eval error: assert failed pc=1234. Details: app=2449590623, pc=1234, opcodes=intc_1; assert'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'logic_eval_error',
                params: { appId: 2449590623n, detail: 'assert failed pc=1234' },
            })
        })

        test('parses a logic eval error without Details suffix', () => {
            const msg = 'logic eval error: err opcode executed'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'logic_eval_error',
                params: { appId: undefined, detail: 'err opcode executed' },
            })
        })
    })

    describe('unavailable resource', () => {
        test('parses unavailable Account', () => {
            const msg =
                'logic eval error: unavailable Account OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24. Details: app=2449590623, pc=100'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'unavailable_resource',
                params: {
                    resourceType: 'Account',
                    resource:
                        'OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24',
                },
            })
        })

        test('parses unavailable Asset', () => {
            const msg =
                'logic eval error: unavailable Asset 31566704. Details: pc=42'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'unavailable_resource',
                params: { resourceType: 'Asset', resource: '31566704' },
            })
        })

        test('parses invalid Box reference', () => {
            const msg =
                'logic eval error: invalid Box reference 0x00000000000026b7. Details: pc=55'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'unavailable_resource',
                params: { resourceType: 'Box', resource: '0x00000000000026b7' },
            })
        })
    })

    describe('group fee too small', () => {
        test('parses a pooled-fee shortfall', () => {
            const msg =
                'TransactionPool.Remember: txgroup had 4000 in fees, which is less than the minimum number of transactions per group * minFee (6 * 1000 = 6000)'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'group_fee_too_small',
                params: { paid: 4000n, required: 6000n },
            })
        })

        test('parses a required amount even without the arithmetic suffix', () => {
            const msg =
                'txgroup had 2000 in fees, which is less than the minimum 5000'
            expect(parseAlgodMessage(msg)).toEqual({
                code: 'group_fee_too_small',
                params: { paid: 2000n, required: 5000n },
            })
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
