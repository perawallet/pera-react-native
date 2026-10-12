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

import { Decimal } from 'decimal.js'
import {
    decodeFunctionResult,
    encodeFunctionData,
    erc20Abi,
    getAddress,
    multicall3Abi,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { partition } from '@perawallet/wallet-core-shared'
import { createEvmClient } from './createEvmClient'

/**
 * The contract's own answers, with no Pera opinion: always unverified. The
 * device-local flags stay unset so persisting it keeps the user's own.
 */
export const readErc20 = async (
    ctx: ChainContext,
    assetId: string,
    scope: ChainScope,
): Promise<PeraAsset> => {
    const client = createEvmClient(scope, ctx)
    const address = getAddress(assetId)
    const [name, symbol, decimals, totalSupply] = await Promise.all([
        client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
        client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({
            address,
            abi: erc20Abi,
            functionName: 'decimals',
        }),
        client.readContract({
            address,
            abi: erc20Abi,
            functionName: 'totalSupply',
        }),
    ])
    return {
        assetId: address,
        name,
        unitName: symbol,
        decimals,
        totalSupply: new Decimal(totalSupply.toString()),
        creator: { address: '' },
        peraMetadata: {
            isDeleted: false,
            verificationTier: PeraAssetVerificationTier.unverified,
            type: PeraAssetType.standard_asset,
        },
    }
}

// Canonical Multicall3, deployed at this address on every chain we serve; the
// viem chain we build declares no multicall contract, so it is passed in.
export const MULTICALL3_ADDRESS: Address =
    '0xcA11bde05977b3631167028862bE2a173976CA11'

export type HolderBalances = {
    /** Base units. */
    wei: bigint
    /** Base units, keyed by checksummed contract; a token whose read failed is absent. */
    tokens: Map<string, bigint>
}

// Bounds the gas one eth_call spends, well under the caps nodes put on it.
const CALLS_PER_AGGREGATE = 300

type BalanceCall = {
    holder: Address
    /** Null for the holder's ETH balance. */
    token: Address | null
    call: { target: Address; allowFailure: boolean; callData: Hex }
}

const balanceCalls = (holder: Address, tokens: Address[]): BalanceCall[] => {
    const balanceOf = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [holder],
    })
    return [
        {
            holder,
            token: null,
            // A failed ETH read fails the aggregate: a holder without it
            // would read as empty.
            call: {
                target: MULTICALL3_ADDRESS,
                allowFailure: false,
                callData: encodeFunctionData({
                    abi: multicall3Abi,
                    functionName: 'getEthBalance',
                    args: [holder],
                }),
            },
        },
        ...tokens.map(token => ({
            holder,
            token,
            call: { target: token, allowFailure: true, callData: balanceOf },
        })),
    ]
}

/**
 * Every holder's ETH balance and `balanceOf` for every token, through Multicall3
 * `aggregate3` at `blockNumber`, keyed by checksummed holder. The aggregates go
 * out together, so a batching transport sends them as one request. A token
 * whose call reverts or answers with no or truncated data is left out; a
 * failed aggregate rejects the whole read.
 */
export const readBalances = async (
    client: PublicClient,
    holders: string[],
    tokenIds: string[],
    blockNumber: bigint,
): Promise<Map<string, HolderBalances>> => {
    const tokens = tokenIds.map(id => getAddress(id))
    const owners = [...new Set(holders.map(holder => getAddress(holder)))]
    // Not client.multicall: with allowFailure it turns a failed call as a
    // whole into per-call failures, which would wipe every holding.
    const chunks = await Promise.all(
        partition(
            owners.flatMap(owner => balanceCalls(owner, tokens)),
            CALLS_PER_AGGREGATE,
        ).map(async calls => ({
            calls,
            results: await client.readContract({
                address: MULTICALL3_ADDRESS,
                abi: multicall3Abi,
                functionName: 'aggregate3',
                args: [calls.map(({ call }) => call)],
                blockNumber,
            }),
        })),
    )
    const balances = new Map<string, HolderBalances>(
        owners.map(owner => [owner, { wei: 0n, tokens: new Map() }]),
    )
    for (const { calls, results } of chunks) {
        results.forEach(({ success, returnData }, index) => {
            const { holder, token } = calls[index]!
            const entry = balances.get(holder)!
            if (token === null) {
                entry.wei = decodeFunctionResult({
                    abi: multicall3Abi,
                    functionName: 'getEthBalance',
                    data: returnData,
                })
                return
            }
            if (!success) return
            try {
                entry.tokens.set(
                    token,
                    decodeFunctionResult({
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        data: returnData,
                    }),
                )
            } catch {
                // A target with no code "succeeds" with empty return data.
            }
        })
    }
    return balances
}
