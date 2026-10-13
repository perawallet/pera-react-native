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
import { Decimal } from 'decimal.js'
import { getDebitedAddress, isOutgoingFor } from '../direction'
import type { TransactionHistoryItem } from '../../models'

const AUTHORITY = 'AUTHORITY_ADDR'
const DRAINED = 'DRAINED_ADDR'
const RECEIVER = 'RECEIVER_ADDR'

const item = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem =>
    ({
        id: 'TX123',
        txType: 'axfer',
        sender: AUTHORITY,
        assetSender: null,
        receiver: RECEIVER,
        confirmedRound: 41065416,
        roundTime: 1752576000,
        swapGroupDetail: null,
        interpretedMeaning: null,
        fee: new Decimal(1000),
        groupId: null,
        amount: new Decimal(150),
        closeTo: null,
        closeAmount: null,
        asset: null,
        applicationId: null,
        innerTransactionCount: null,
        balanceImpacts: [],
        ...overrides,
    }) as TransactionHistoryItem

describe('getDebitedAddress', () => {
    it('is the sender on an ordinary transfer', () => {
        expect(getDebitedAddress(item())).toBe(AUTHORITY)
    })

    it('is the asset sender on a clawback', () => {
        expect(getDebitedAddress(item({ assetSender: DRAINED }))).toBe(DRAINED)
    })
})

describe('isOutgoingFor', () => {
    it('is outgoing for the account a clawback debits', () => {
        expect(isOutgoingFor(item({ assetSender: DRAINED }), DRAINED)).toBe(
            true,
        )
    })

    it('is incoming for the receiver of a clawback', () => {
        expect(isOutgoingFor(item({ assetSender: DRAINED }), RECEIVER)).toBe(
            false,
        )
    })

    it('is outgoing for an authority clawing back to a third party', () => {
        expect(isOutgoingFor(item({ assetSender: DRAINED }), AUTHORITY)).toBe(
            true,
        )
    })

    it('is incoming for an authority clawing back to itself', () => {
        expect(
            isOutgoingFor(
                item({ assetSender: DRAINED, receiver: AUTHORITY }),
                AUTHORITY,
            ),
        ).toBe(false)
    })
})
