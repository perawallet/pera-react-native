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
import { getAddress, maxUint160, maxUint256 } from 'viem'
import type { TypedDataDefinition } from 'viem'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { spendApprovalOfCall, toAllowanceAmount } from '../allowance'
import { spendApprovalOf } from '../permits'
import type { EvmStandardCall } from '../standard-call-types'
import {
    EIP2612_PERMIT_TYPED_DATA,
    PERMIT_NOW_MS,
    PERMIT_SPENDER,
    PERMIT_USDC,
    SENDER,
} from './fixtures'

const USDC = getAddress(PERMIT_USDC)
const SPENDER = getAddress(PERMIT_SPENDER)

const approve = (
    value: bigint,
    kind: 'approve' | 'increase-allowance' = 'approve',
): EvmStandardCall => ({
    kind,
    contract: USDC,
    spender: SPENDER,
    value: new Decimal(value.toString()),
})

const permitFor = (value: bigint): TypedDataDefinition =>
    ({
        ...EIP2612_PERMIT_TYPED_DATA,
        message: {
            ...EIP2612_PERMIT_TYPED_DATA.message,
            value: value.toString(),
        },
    }) as TypedDataDefinition

describe('toAllowanceAmount', () => {
    it('keeps an amount below 2^160 exact', () => {
        expect(toAllowanceAmount(maxUint160 - 1n)).toEqual(
            new Decimal((maxUint160 - 1n).toString()),
        )
    })

    it('treats 2^160 and above as unlimited', () => {
        expect(toAllowanceAmount(maxUint160)).toBeUndefined()
        expect(toAllowanceAmount(maxUint256)).toBeUndefined()
    })
})

describe('spendApprovalOfCall', () => {
    it('grants the spender the token until it is revoked', () => {
        expect(spendApprovalOfCall(approve(1_000_000n), 'ethereum')).toEqual({
            spender: SPENDER,
            allowances: [
                {
                    assetRef: { chainId: 'ethereum', assetId: USDC },
                    amount: new Decimal(1_000_000),
                },
            ],
            isLongLived: true,
        })
    })

    it('leaves the amount out when it is unlimited', () => {
        expect(
            spendApprovalOfCall(
                approve(maxUint256, 'increase-allowance'),
                'ethereum',
            )?.allowances[0].amount,
        ).toBeUndefined()
    })

    it('is nothing for a revocation or a call that grants nothing', () => {
        expect(spendApprovalOfCall(approve(0n), 'ethereum')).toBeUndefined()
        expect(
            spendApprovalOfCall(
                {
                    kind: 'transfer',
                    contract: USDC,
                    from: SENDER,
                    to: SPENDER,
                    value: new Decimal(1),
                },
                'ethereum',
            ),
        ).toBeUndefined()
        expect(
            spendApprovalOfCall(
                {
                    kind: 'set-approval-for-all',
                    contract: USDC,
                    operator: SPENDER,
                    isApproved: true,
                },
                'ethereum',
            ),
        ).toBeUndefined()
    })

    it.each([
        ['a limited', 1_000_000n],
        ['the largest limited', maxUint160 - 1n],
        ['an unlimited', maxUint160],
        ['a maximal', maxUint256],
    ])(
        'grants %s allowance exactly as a permit for the same value does',
        (_, value) => {
            const permit = spendApprovalOf(
                permitFor(value),
                PERMIT_NOW_MS,
                ETHEREUM,
            )
            const transaction = spendApprovalOfCall(
                approve(value),
                ETHEREUM.row.id,
            )

            expect(transaction?.spender).toBe(permit?.spender)
            expect(transaction?.allowances).toEqual(permit?.allowances)
        },
    )
})
