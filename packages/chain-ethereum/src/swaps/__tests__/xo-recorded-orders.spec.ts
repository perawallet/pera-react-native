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
import { getAddress } from 'viem'
import type { SwapQuoteRequest } from '@perawallet/wallet-core-swaps'
import { evmChainOfEip155Id } from '../../chains/table'
import { evmScopeOf } from '../../__tests__/evm-chains'
import { decodeSwapTransaction } from '../decode-swap-transaction'
import { validateEvmSwapTransactions } from '../validate-swap-transactions'
import { XO_RECORDED_ORDERS, type XoRecordedOrder } from './xo-recorded-orders'

// USDC and USDT on Ethereum; every native source here has 18.
const TOKEN_DECIMALS: Record<string, number> = {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,
}

const validateRecorded = (order: XoRecordedOrder) => {
    const [, eip155Id, asset] = /^eip155:(\d+)\/(.+)$/.exec(order.fromAsset)!
    const { chain } = evmChainOfEip155Id(Number(eip155Id))!
    const scope = evmScopeOf(chain)
    const token = asset.startsWith('erc20:') ? asset.slice(6) : null
    const decimals = token ? TOKEN_DECIMALS[token.toLowerCase()] : 18
    const request: SwapQuoteRequest = {
        sourceAsset: {
            ...scope,
            assetId: token ? getAddress(token) : chain.nativeAsset.assetId,
        },
        destinationAsset: { ...scope, assetId: chain.nativeAsset.assetId },
        sourceAmount: new Decimal(order.amount).mul(
            new Decimal(10).pow(decimals),
        ),
        sourceAddress: order.fromAddress,
        destinationAddress: order.fromAddress,
        slippage: null,
    }
    return validateEvmSwapTransactions({
        calls: order.unsignedTransactions.map(decodeSwapTransaction),
        request,
        scope,
        chain,
    })
}

describe("XO's recorded orders", () => {
    it.each(XO_RECORDED_ORDERS.map(order => [order.name, order] as const))(
        'signs %s as a deposit to its pay-in address, paid out later',
        (_name, order) => {
            const plan = validateRecorded(order)

            expect(plan).toMatchObject({
                approval: null,
                counterparty: getAddress(order.payInAddress),
                isPaidOutLater: true,
            })
        },
    )
})
