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
    type PublicClient,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
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
            verificationTier: 'unverified',
            type: 'standard_asset',
        },
    }
}

// Canonical Multicall3, deployed at this address on every chain we serve; the
// viem chain we build declares no multicall contract, so it is passed in.
export const MULTICALL3_ADDRESS: Address =
    '0xcA11bde05977b3631167028862bE2a173976CA11'

/**
 * `balanceOf(holder)` for every token in one `aggregate3` call at `blockNumber`,
 * in base units keyed by checksummed contract. A token whose call reverts is
 * left out; a failed call as a whole rejects.
 */
export const readErc20Balances = async (
    client: PublicClient,
    holder: string,
    tokenIds: string[],
    blockNumber: bigint,
): Promise<Map<string, bigint>> => {
    if (tokenIds.length === 0) return new Map()
    const owner = getAddress(holder)
    const tokens = tokenIds.map(id => getAddress(id))
    const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [owner],
    })
    // Not client.multicall: with allowFailure it turns a failed call as a
    // whole into per-token failures, which would wipe every token holding.
    const results = await client.readContract({
        address: MULTICALL3_ADDRESS,
        abi: multicall3Abi,
        functionName: 'aggregate3',
        args: [
            tokens.map(target => ({ target, allowFailure: true, callData })),
        ],
        blockNumber,
    })
    const balances = new Map<string, bigint>()
    results.forEach(({ success, returnData }, index) => {
        if (!success) return
        try {
            balances.set(
                tokens[index]!,
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
    return balances
}
