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
    BaseError,
    ContractFunctionRevertedError,
    ContractFunctionZeroDataError,
    decodeFunctionResult,
    encodeFunctionData,
    erc20Abi,
    getAddress,
    hexToString,
    IntegerOutOfRangeError,
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
import { partition, type Nullable } from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../../chains/types'
import { toRpcTransportError } from '../errors/toRpcTransportError'
import { createEvmClient } from './createEvmClient'

const bytes32TextAbi = [
    {
        type: 'function',
        name: 'name',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'symbol',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
] as const

// A bytes32 word read as a string head is an offset far past the safe-integer
// range, which viem's decoder rejects with this error.
const isBytes32Text = (error: unknown): boolean =>
    error instanceof BaseError &&
    error.walk(cause => cause instanceof IntegerOutOfRangeError) !== null

// MKR and SAI return bytes32 for name and symbol, which the string decoder
// fails on. Only that failure retries as bytes32: after any other error the
// retry would decode a string token's ABI head as text.
const readText = async (
    client: PublicClient,
    address: Address,
    functionName: 'name' | 'symbol',
): Promise<string> => {
    try {
        return await client.readContract({
            address,
            abi: erc20Abi,
            functionName,
        })
    } catch (error) {
        if (!isBytes32Text(error)) throw error
        const packed = await client
            .readContract({ address, abi: bytes32TextAbi, functionName })
            .catch(() => {
                throw error
            })
        return hexToString(packed, { size: 32 })
    }
}

// A contract that reverts, or answers with no data, has no supply to report;
// the caller reads zero as unknown. Anything else is a failed read.
const hasNoSupplyAnswer = (error: unknown): boolean =>
    error instanceof BaseError &&
    error.walk(
        cause =>
            cause instanceof ContractFunctionRevertedError ||
            cause instanceof ContractFunctionZeroDataError,
    ) !== null

/**
 * Base units; one call, for a caller that needs only the supply. Zero when the
 * contract has none to read. A node that can't be reached rejects with a
 * transient `PeraNetworkError`.
 */
export const readErc20TotalSupply = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetId: string,
    scope: ChainScope,
): Promise<Decimal> => {
    try {
        const totalSupply = await createEvmClient(
            scope,
            ctx,
            chain,
        ).readContract({
            address: getAddress(assetId),
            abi: erc20Abi,
            functionName: 'totalSupply',
        })
        return new Decimal(totalSupply.toString())
    } catch (error) {
        if (hasNoSupplyAnswer(error)) return new Decimal(0)
        throw toRpcTransportError(error) ?? error
    }
}

/**
 * The contract's own answers, with no Pera opinion: always unverified. The
 * device-local flags stay unset so persisting it keeps the user's own.
 */
export const readErc20 = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetId: string,
    scope: ChainScope,
): Promise<PeraAsset> => {
    const client = createEvmClient(scope, ctx, chain)
    const address = getAddress(assetId)
    const [name, symbol, decimals, totalSupply] = await Promise.all([
        readText(client, address, 'name'),
        readText(client, address, 'symbol'),
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

type Aggregate3Call = { target: Address; allowFailure: boolean; callData: Hex }
type Aggregate3Result = { success: boolean; returnData: Hex }

// Not client.multicall: with allowFailure it turns a failed call as a whole
// into per-call failures, which a caller can't tell from per-call reverts.
// The chunks go out together, so a batching transport sends one request.
const aggregate3 = async (
    client: PublicClient,
    calls: Aggregate3Call[],
    blockNumber?: bigint,
): Promise<Aggregate3Result[]> => {
    const chunks = await Promise.all(
        partition(calls, CALLS_PER_AGGREGATE).map(chunk =>
            client.readContract({
                address: MULTICALL3_ADDRESS,
                abi: multicall3Abi,
                functionName: 'aggregate3',
                args: [chunk],
                blockNumber,
            }),
        ),
    )
    const results = chunks.flatMap(chunk => [...chunk])
    // Callers pair results to calls by index, so a short answer must reject
    // rather than shift every later pairing.
    if (results.length !== calls.length) {
        throw new Error(
            `Multicall3 answered ${results.length} of ${calls.length} calls`,
        )
    }
    return results
}

type BalanceCall = {
    holder: Address
    /** Null for the holder's ETH balance. */
    token: Nullable<Address>
    call: Aggregate3Call
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
 * `aggregate3` at `blockNumber`, keyed by checksummed holder. A token
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
    const calls = owners.flatMap(owner => balanceCalls(owner, tokens))
    const results = await aggregate3(
        client,
        calls.map(({ call }) => call),
        blockNumber,
    )
    const balances = new Map<string, HolderBalances>(
        owners.map(owner => [owner, { wei: 0n, tokens: new Map() }]),
    )
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
    return balances
}

// viem decodes a uint8 word without range-checking it, so a hostile contract
// could otherwise store a scale no amount conversion should ever use.
const isUint8 = (value: unknown): value is number =>
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= 255

/**
 * Each token's own `decimals()`, keyed by checksummed contract, through
 * Multicall3 `aggregate3` at the latest block. A token whose call reverts,
 * answers with no, truncated or out-of-range data is left out, so absent means
 * unverified. When the aggregate itself fails, as one contract that burns the
 * call's gas makes it, each token is read on its own so that contract can't
 * hide the rest; the node being unreachable still rejects.
 */
export const readErc20Decimals = async (
    client: PublicClient,
    tokenIds: string[],
): Promise<Map<string, number>> => {
    const tokens = [...new Set(tokenIds.map(id => getAddress(id)))]
    const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'decimals',
    })
    const decimals = new Map<string, number>()
    const keep = (token: string, value: unknown): void => {
        if (isUint8(value)) decimals.set(token, value)
    }
    try {
        const results = await aggregate3(
            client,
            tokens.map(target => ({ target, allowFailure: true, callData })),
        )
        results.forEach(({ success, returnData }, index) => {
            if (!success) return
            try {
                keep(
                    tokens[index]!,
                    decodeFunctionResult({
                        abi: erc20Abi,
                        functionName: 'decimals',
                        data: returnData,
                    }),
                )
            } catch {
                // A target with no code "succeeds" with empty return data.
            }
        })
    } catch (error) {
        const reads = await Promise.allSettled(
            tokens.map(address =>
                client.readContract({
                    address,
                    abi: erc20Abi,
                    functionName: 'decimals',
                }),
            ),
        )
        if (tokens.length > 0 && reads.every(r => r.status === 'rejected')) {
            throw error
        }
        reads.forEach((read, index) => {
            if (read.status === 'fulfilled') keep(tokens[index]!, read.value)
        })
    }
    return decimals
}
