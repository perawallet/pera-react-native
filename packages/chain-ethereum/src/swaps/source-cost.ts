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

import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import type { PublicClient } from 'viem'
import { Decimal } from 'decimal.js'
import {
    isNativeAsset,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { toBigInt } from '@perawallet/wallet-core-shared'
import type { SwapQuote, SwapSourceCost } from '@perawallet/wallet-core-swaps'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import {
    readEvmFeePresets,
    readEvmSurcharge,
    SURCHARGE_HEADROOM,
} from '../transfer/fees'

// XO answers EVM orders with a deposit (one token `transfer` or native send to
// the order's pay-in address) and sets this gas limit on it. An approve-then-swap
// order costs more; each of its transactions is checked against the balance.
export const SWAP_DEPOSIT_GAS_CEILING = 100_000n

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

/** Wei the account is short of `required`, or null when it can pay. */
export const evmShortfallOf = (
    balance: bigint,
    required: bigint,
): SwapSourceCost['shortfall'] =>
    required > balance ? toDecimal(required - balance) : null

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
    const gas = SWAP_DEPOSIT_GAS_CEILING
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
