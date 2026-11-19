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

import {
    concat,
    encodeFunctionData,
    erc20Abi,
    getAddress,
    keccak256,
    toHex,
} from 'viem'
import type { Address, PublicClient } from 'viem'
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

// There are no calldata to estimate before the order, so the shown fee is a
// ceiling from what a token approval and a routed swap take.
export const SWAP_APPROVAL_GAS_CEILING = 70_000n
export const SWAP_CALL_GAS_CEILING = 400_000n
// The same for the OP-stack L1 fee, which prices calldata: the swap is priced on
// hashes of this length, which don't compress, so no routed swap encodes cheaper.
export const SWAP_CALLDATA_BYTES_CEILING = 1536
const SWAP_CALLDATA_STAND_IN = concat(
    Array.from({ length: SWAP_CALLDATA_BYTES_CEILING / 32 }, (_, index) =>
        keccak256(toHex(index)),
    ),
)

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
    // The contract an order will call isn't known until the order exists, so
    // no allowance can be read yet: any token source is priced with an approval.
    const needsSpendApproval = !isNative
    const gas =
        SWAP_CALL_GAS_CEILING +
        (needsSpendApproval ? SWAP_APPROVAL_GAS_CEILING : 0n)
    // A nonce moves the encoding by a few bytes, well inside the calldata ceiling.
    const priced = {
        type: 'eip1559',
        chainId: eip155ChainIdOf(scope, chain),
        nonce: 0,
        ...presets.normal,
    } as const
    // The order's contract isn't known yet; any address prices the same calldata.
    const spender = owner
    const [swapSurcharge, approvalSurcharge] = await Promise.all([
        readEvmSurcharge(client, chain, {
            ...priced,
            to: spender,
            value: isNative ? amount : 0n,
            data: SWAP_CALLDATA_STAND_IN,
            gas: SWAP_CALL_GAS_CEILING,
        }),
        needsSpendApproval
            ? readEvmSurcharge(client, chain, {
                  ...priced,
                  to: getAddress(sourceAsset.assetId),
                  value: 0n,
                  data: encodeFunctionData({
                      abi: erc20Abi,
                      functionName: 'approve',
                      args: [spender, amount],
                  }),
                  gas: SWAP_APPROVAL_GAS_CEILING,
              })
            : 0n,
    ])
    const surcharge = swapSurcharge + approvalSurcharge
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
        needsSpendApproval,
        nativeSymbol: chain.row.nativeAsset.symbol,
        nativeDecimals: chain.row.nativeAsset.decimals,
    }
}
