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

import algosdk, { OnApplicationComplete, type SuggestedParams } from 'algosdk'
import { describe, expect, it } from 'vitest'

import { formatFieldDiff } from '../diff'
import { assertIntentComplete, compareIntent, type TxnIntent } from '../intent'

const SENDER = 'D327XK5WDP3SOPOAAZDA57EY3NOA56NLPO47BELJOJEJG5Z6DWAQBLWJKA'
const OTHER = 'YDKJUHL3Z6FZ2U54WUFLYGLOKX5HKG34255M5ZEPPSGZB7A2P6DTTU26UM'

// These transactions are never submitted: this file tests the projection, not
// the chain. The round-trip spec is where transactions meet a real node.
const PARAMS: SuggestedParams = {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 1n,
    lastValid: 1001n,
    genesisID: 'dockernet-v1',
    genesisHash: new Uint8Array(32),
    flatFee: true,
}

const diffOf = (intent: TxnIntent, txn: algosdk.Transaction): string => {
    const { expected, actual } = compareIntent(intent, txn)
    return formatFieldDiff(expected, actual)
}

describe('assertIntentComplete', () => {
    it('accepts an intent that declares its operation payload', () => {
        expect(() =>
            assertIntentComplete({
                type: 'pay',
                sender: SENDER,
                fee: 1000n,
                receiver: OTHER,
                amount: 1n,
            }),
        ).not.toThrow()
    })

    it.each([
        [
            'a payment with no amount',
            { type: 'pay', sender: SENDER, fee: 1000n, receiver: OTHER },
            'amount',
        ],
        [
            'an asset transfer with no asset id',
            {
                type: 'axfer',
                sender: SENDER,
                fee: 1000n,
                receiver: OTHER,
                amount: 1n,
            },
            'assetId',
        ],
        [
            'an application call with no onComplete',
            { type: 'appl', sender: SENDER, fee: 1000n, appIndex: 7n },
            'onComplete',
        ],
        [
            'a freeze with no target',
            { type: 'afrz', sender: SENDER, fee: 1000n, assetId: 7n },
            'freezeAccount',
        ],
    ])('rejects %s', (_label, intent, missing) => {
        expect(() => assertIntentComplete(intent as TxnIntent)).toThrow(
            new RegExp(missing),
        )
    })

    it('rejects an intent with no fee, whatever the type', () => {
        expect(() =>
            assertIntentComplete({
                type: 'keyreg',
                sender: SENDER,
            } as unknown as TxnIntent),
        ).toThrow(/fee/)
    })
})

describe('compareIntent', () => {
    it('flags an asset config that reassigns a role the intent never mentioned', () => {
        const txn = algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
            sender: SENDER,
            assetIndex: 7n,
            manager: OTHER,
            strictEmptyAddressChecking: false,
            suggestedParams: PARAMS,
        })

        const diff = diffOf(
            { type: 'acfg', sender: SENDER, fee: 1000n, assetId: 7n },
            txn,
        )

        expect(diff).toContain('manager')
        expect(diff).toContain(OTHER)
    })

    it('flags a key registration that marks the account non-participating', () => {
        const txn = algosdk.makeKeyRegistrationTxnWithSuggestedParamsFromObject(
            {
                sender: SENDER,
                nonParticipation: true,
                suggestedParams: PARAMS,
            },
        )

        const diff = diffOf({ type: 'keyreg', sender: SENDER, fee: 1000n }, txn)

        expect(diff).toContain('nonParticipation')
        expect(diff).toContain('true')
    })

    it('names the application onComplete rather than printing its number', () => {
        const txn = algosdk.makeApplicationCallTxnFromObject({
            sender: SENDER,
            appIndex: 7n,
            onComplete: OnApplicationComplete.DeleteApplicationOC,
            suggestedParams: PARAMS,
        })

        const diff = diffOf(
            {
                type: 'appl',
                sender: SENDER,
                fee: 1000n,
                appIndex: 7n,
                onComplete: OnApplicationComplete.NoOpOC,
            },
            txn,
        )

        expect(diff).toContain('onComplete')
        expect(diff).toContain('DeleteApplicationOC')
        expect(diff).toContain('NoOpOC')
    })

    it('compares the freeze target and direction when declared', () => {
        const txn = algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
            sender: SENDER,
            assetIndex: 7n,
            freezeTarget: OTHER,
            frozen: true,
            suggestedParams: PARAMS,
        })

        expect(
            diffOf(
                {
                    type: 'afrz',
                    sender: SENDER,
                    fee: 1000n,
                    assetId: 7n,
                    freezeAccount: OTHER,
                    frozen: true,
                },
                txn,
            ),
        ).toBe('')

        expect(
            diffOf(
                {
                    type: 'afrz',
                    sender: SENDER,
                    fee: 1000n,
                    assetId: 7n,
                    freezeAccount: OTHER,
                    frozen: false,
                },
                txn,
            ),
        ).toContain('frozen')
    })
})
