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

import { erc20Abi, getAddress } from 'viem'
import type { Address, PublicClient } from 'viem'
import { Decimal } from 'decimal.js'
import {
    isNativeAsset,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { toBigInt } from '@perawallet/wallet-core-shared'
import type { SwapQuote, SwapSourceCost } from '@perawallet/wallet-core-swaps'
import type { EvmChain } from '../chains/types'
import { readEvmFeePresets } from '../transfer/fees'

// There are no calldata to estimate before the order, so the shown fee is a
// ceiling from what a token approval and a routed swap take.
export const SWAP_APPROVAL_GAS_CEILING = 70_000n
export const SWAP_CALL_GAS_CEILING = 400_000n

export const readEvmAllowance = (
    client: PublicClient,
    {
        token,
        owner,
        spender,
    }: { token: Address; owner: Address; spender: Address },
): Promise<bigint> =>
    client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender],
    })

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
    routeContracts,
}: {
    client: PublicClient
    chain: EvmChain
    quote: SwapQuote
    scope: ChainScope
    routeContracts: readonly Address[]
}): Promise<SwapSourceCost> => {
    const { sourceAsset, sourceAddress, sourceAmount } = quote.request
    const owner = getAddress(sourceAddress)
    const amount = toBigInt(sourceAmount)
    const isNative = isNativeAsset(sourceAsset, chain.descriptor)
    const [balance, { presets }, allowances] = await Promise.all([
        client.getBalance({ address: owner }),
        readEvmFeePresets(client, chain, scope.networkId),
        isNative
            ? []
            : Promise.all(
                  routeContracts.map(spender =>
                      readEvmAllowance(client, {
                          token: getAddress(sourceAsset.assetId),
                          owner,
                          spender,
                      }),
                  ),
              ),
    ])
    // Which contract an order will name isn't known yet, so any one short counts.
    const needsSpendApproval =
        !isNative &&
        (allowances.length === 0 ||
            allowances.some(allowance => allowance < amount))
    const gas =
        SWAP_CALL_GAS_CEILING +
        (needsSpendApproval ? SWAP_APPROVAL_GAS_CEILING : 0n)
    const networkFee = gas * presets.normal.maxFeePerGas
    return {
        networkFee: toDecimal(networkFee),
        shortfall: evmShortfallOf(
            balance,
            networkFee + (isNative ? amount : 0n),
        ),
        needsSpendApproval,
        nativeSymbol: chain.row.nativeAsset.symbol,
        nativeDecimals: chain.row.nativeAsset.decimals,
    }
}
