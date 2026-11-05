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
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'

import { server } from '@test-utils/msw-server'
import { buildPaymentTransaction } from '@test-utils/signing-review'
import { encodeTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    mockCreateSwapOrder,
    mockReportSwapOrder,
} from '@perawallet/wallet-core-swaps/test-handlers'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

export const SWAP_ORDER_ID = 'order-98765'
export const ALGORAND_MAINNET_CAIP2 =
    'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

const ALGO = {
    chainId: 'algorand',
    networkId: 'mainnet',
    assetId: '0',
} as const
const USDC = {
    chainId: 'algorand',
    networkId: 'mainnet',
    assetId: '31566704',
} as const

/** A fresh ALGO → USDC quote for `sourceAmount` microAlgos. */
export const buildRouterSwapQuote = (
    swapperAddress: string,
    sourceAmount = 1_000_000,
): SwapQuote => ({
    quoteId: 'quote-1',
    request: {
        sourceAsset: ALGO,
        destinationAsset: USDC,
        sourceAmount: new Decimal(sourceAmount),
        sourceAddress: swapperAddress,
        destinationAddress: swapperAddress,
        slippage: null,
    },
    provider: 'tinyman',
    routeKind: 'single-chain',
    assetIn: {
        assetId: '0',
        ref: ALGO,
        name: 'Algorand',
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'verified',
        crossChainAssetGroup: null,
    },
    assetOut: {
        assetId: '31566704',
        ref: USDC,
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
        verificationTier: 'verified',
        crossChainAssetGroup: null,
    },
    amountIn: new Decimal(sourceAmount),
    amountOut: new Decimal(300_000),
    minimumAmountOut: new Decimal(297_000),
    amountInUsdValue: null,
    amountOutUsdValue: null,
    fees: [],
    priceImpact: null,
    expiresAt: null,
    // execute() refuses a quote without a recent `fetchedAt` as stale.
    fetchedAt: Date.now(),
    depositAddress: null,
})

/** An order whose one step is a single user-signed payment of `amount` from `sender`. */
export const mockSwapOrderWithPayment = ({
    sender,
    receiver,
    amount = 1_000_000n,
}: {
    sender: string
    receiver: string
    amount?: bigint
}): void => {
    const unsigned = buildPaymentTransaction({ sender, receiver, amount })
    server.use(
        mockCreateSwapOrder({
            response: {
                order_id: SWAP_ORDER_ID,
                status: 'pending',
                expires_at: null,
                steps: [
                    {
                        kind: 'sign_transactions',
                        chain: ALGORAND_MAINNET_CAIP2,
                        purpose: 'swap',
                        transactions: [
                            encodeToBase64(encodeTransaction(unsigned)),
                        ],
                        signed_transactions: [null],
                    },
                ],
            },
        }),
    )
}

/** Records what reaches algod and every report sent for the order. */
export const spyOnSwapSubmissionAndReports = () => {
    const algodBodies: Uint8Array[] = []
    const reports: Array<Record<string, unknown>> = []
    server.use(
        http.post('*/v2/transactions', async ({ request }) => {
            algodBodies.push(new Uint8Array(await request.arrayBuffer()))
            return HttpResponse.json(
                {
                    txId: 'SWAPTXID000000000000000000000000000000000000000000001',
                },
                { status: 200 },
            )
        }),
        // Background confirmation poll after submit: keep it green so the
        // flow's confirmation branch settles quietly.
        http.get('*/v2/transactions/pending/*', () =>
            HttpResponse.json(
                { 'confirmed-round': 101, 'pool-error': '' },
                { status: 200 },
            ),
        ),
        http.get('*/v2/status', () =>
            HttpResponse.json({ 'last-round': 100 }, { status: 200 }),
        ),
        // Listed before the report mock so it sees the body, then falls through.
        http.patch(
            `*/api/v4/swap/orders/${SWAP_ORDER_ID}/`,
            async ({ request }) => {
                reports.push(
                    (await request.clone().json()) as Record<string, unknown>,
                )
                return undefined
            },
        ),
        mockReportSwapOrder({
            response: {
                order_id: SWAP_ORDER_ID,
                aggregator: 'pera',
                provider: 'tinyman',
                status: 'in_progress',
                funding_method: 'wallet',
                source_account: null,
                destination_account: null,
                source_asset: null,
                destination_asset: null,
                source_amount: null,
                destination_amount_expected: null,
                destination_amount_minimum: null,
                destination_amount_received: null,
                source_amount_usd_value: null,
                destination_amount_usd_value: null,
                transactions: [],
                created_at: '2026-10-01T10:00:00Z',
                updated_at: '2026-10-01T10:00:00Z',
                expires_at: null,
            },
        }),
    )
    return { algodBodies, reports }
}
