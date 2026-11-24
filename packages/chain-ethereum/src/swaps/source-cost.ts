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

import { encodeFunctionData, erc20Abi, getAddress, zeroAddress } from 'viem'
import type { PublicClient } from 'viem'
import { Decimal } from 'decimal.js'
import {
    isNativeAsset,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    displayUnitsToBaseUnits,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import type { SwapQuote, SwapSourceCost } from '@perawallet/wallet-core-swaps'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import {
    INTRINSIC_TRANSFER_GAS,
    readEvmFeePresets,
    readEvmSurcharge,
    SURCHARGE_HEADROOM,
} from '../transfer/fees'

// XO's orders are one deposit to a pay-in address. Execution signs the node's
// estimate: exact for a native send, a fifth over ~65k for a token `transfer`.
// A rarer approve-then-swap costs more but is checked against the balance.
export const SWAP_TOKEN_DEPOSIT_GAS_CEILING = 100_000n

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

/** Wei the account is short of `required`, or null when it can pay. */
export const evmShortfallOf = (
    balance: bigint,
    required: bigint,
): SwapSourceCost['shortfall'] =>
    required > balance ? toDecimal(required - balance) : null

// Twice the native deposit's maximum fee, itself priced at twice the base fee:
// room for the fee to climb between MAX and the order.
const MAX_AMOUNT_FEE_RESERVE_MULTIPLE = 2n

// Of the native unit: held back when the fee can't be read, so MAX still works
// offline or on a failing node. Generous on purpose; the live price replaces it
// on the next read.
const FALLBACK_MAX_AMOUNT_FEE_RESERVE = '0.005'

// The reserve keys the spendable-balance query, and the base fee moves every
// block; rounding up to two significant digits keeps each minute's refresh from
// re-keying it (and re-clamping a MAX fill) on drift, and only ever errs high.
const FEE_RESERVE_SIGNIFICANT_DIGITS = 2

const readEvmSwapFeeReserve = async ({
    client,
    chain,
    scope,
}: {
    client: PublicClient
    chain: EvmChain
    scope: ChainScope
}): Promise<Decimal> => {
    const { presets } = await readEvmFeePresets(client, chain, scope.networkId)
    const gas = INTRINSIC_TRANSFER_GAS
    const surcharge = await readEvmSurcharge(client, chain, {
        type: 'eip1559',
        chainId: eip155ChainIdOf(scope, chain),
        nonce: 0,
        gas,
        ...presets.normal,
        to: zeroAddress,
        value: 0n,
        data: '0x',
    })
    return toDecimal(
        MAX_AMOUNT_FEE_RESERVE_MULTIPLE *
            (gas * presets.normal.maxFeePerGas +
                SURCHARGE_HEADROOM * surcharge),
    ).toSignificantDigits(FEE_RESERVE_SIGNIFICANT_DIGITS, Decimal.ROUND_UP)
}

/**
 * Wei held back from a MAX native swap: a multiple of what its one deposit can
 * be charged now, or a flat fallback when the fee can't be read.
 */
export const estimateEvmSwapFeeReserve = async (params: {
    client: PublicClient
    chain: EvmChain
    scope: ChainScope
}): Promise<Decimal> => {
    try {
        return await readEvmSwapFeeReserve(params)
    } catch {
        return displayUnitsToBaseUnits(
            FALLBACK_MAX_AMOUNT_FEE_RESERVE,
            params.chain.row.nativeAsset.decimals,
        )
    }
}

export const estimateEvmSwapSourceCost = async ({
    client,
    chain,
    quote,
    scope,
}: {
    client: PublicClient
    chain: EvmChain
    quote: SwapQuote
    scope: ChainScope
}): Promise<SwapSourceCost> => {
    const { sourceAsset, sourceAddress, sourceAmount } = quote.request
    const owner = getAddress(sourceAddress)
    const amount = toBigInt(sourceAmount)
    const isNative = isNativeAsset(sourceAsset, chain.descriptor)
    const [balance, { baseFeePerGas, presets }] = await Promise.all([
        client.getBalance({ address: owner }),
        readEvmFeePresets(client, chain, scope.networkId),
    ])
    // The pay-in address isn't known until the order exists; any address
    // encodes to the same length.
    const payIn = owner
    const gas = isNative
        ? INTRINSIC_TRANSFER_GAS
        : SWAP_TOKEN_DEPOSIT_GAS_CEILING
    const priced = {
        type: 'eip1559',
        chainId: eip155ChainIdOf(scope, chain),
        nonce: 0,
        gas,
        ...presets.normal,
    } as const
    const surcharge = await readEvmSurcharge(
        client,
        chain,
        isNative
            ? { ...priced, to: payIn, value: amount, data: '0x' }
            : {
                  ...priced,
                  to: getAddress(sourceAsset.assetId),
                  value: 0n,
                  data: encodeFunctionData({
                      abi: erc20Abi,
                      functionName: 'transfer',
                      args: [payIn, amount],
                  }),
              },
    )
    const networkFee =
        gas * presets.normal.maxFeePerGas + SURCHARGE_HEADROOM * surcharge
    // maxFeePerGas carries 2× base-fee headroom; a block charges the base fee itself.
    const expectedNetworkFee =
        gas * (baseFeePerGas + presets.normal.maxPriorityFeePerGas) + surcharge
    return {
        networkFee: toDecimal(networkFee),
        expectedNetworkFee: toDecimal(expectedNetworkFee),
        shortfall: evmShortfallOf(
            balance,
            networkFee + (isNative ? amount : 0n),
        ),
        nativeSymbol: chain.row.nativeAsset.symbol,
        nativeDecimals: chain.row.nativeAsset.decimals,
    }
}
