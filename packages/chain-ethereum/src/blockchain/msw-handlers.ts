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

import { http, HttpResponse, type RequestHandler } from 'msw'
import {
    decodeAbiParameters,
    decodeFunctionData,
    encodeAbiParameters,
    encodeFunctionResult,
    getAddress,
    isAddressEqual,
    keccak256,
    multicall3Abi,
    toFunctionSelector,
    type Hex,
    type RpcFeeHistory,
    type RpcTransactionReceipt,
} from 'viem'
import { MULTICALL3_ADDRESS } from './utils/erc20'

export type EvmRpcResults = {
    eth_chainId: Hex
    eth_blockNumber: Hex
    eth_getBalance: Hex
    eth_getTransactionCount: Hex
    eth_estimateGas: Hex
    eth_feeHistory: RpcFeeHistory
    eth_call: Hex
    eth_sendRawTransaction: Hex
    /** `null` is how a node reports a transaction it hasn't mined yet. */
    eth_getTransactionReceipt: RpcTransactionReceipt | null
}

export type EvmRpcMethod = keyof EvmRpcResults

const JSON_RPC_METHOD_NOT_FOUND = -32_601
const JSON_RPC_INVALID_REQUEST = -32_600

export class EvmRpcErrorFixture {
    constructor(
        readonly code: number,
        readonly message: string,
        readonly data?: unknown,
    ) {}
}

type Outcome<M extends EvmRpcMethod> = EvmRpcResults[M] | EvmRpcErrorFixture

export type EvmRpcResponder<M extends EvmRpcMethod> =
    | Outcome<M>
    | ((params: readonly unknown[]) => Outcome<M>)

export type EvmRpcFixtures = {
    /** Defaults to every host; only JSON-RPC bodies are answered either way. */
    rpcUrl?: string
    responses?: { [M in EvmRpcMethod]?: EvmRpcResponder<M> }
}

const GWEI = '0x3b9aca00'

/** Mainnet, an empty account at block 1, and a 1 gwei base fee. */
export const DEFAULT_EVM_RPC_RESPONSES: {
    [M in EvmRpcMethod]: EvmRpcResponder<M>
} = {
    eth_chainId: '0x1',
    eth_blockNumber: '0x1',
    eth_getBalance: '0x0',
    eth_getTransactionCount: '0x0',
    eth_estimateGas: '0x5208',
    eth_feeHistory: {
        oldestBlock: '0x1',
        baseFeePerGas: [GWEI, GWEI],
        gasUsedRatio: [0.5],
        reward: [[GWEI]],
    },
    eth_call: '0x',
    // The hash a node returns is the keccak of the signed payload.
    eth_sendRawTransaction: params => keccak256(params[0] as Hex),
    eth_getTransactionReceipt: null,
}

/** A mined, successful receipt; pass the fields the test asserts on. */
export const evmTransactionReceipt = (
    overrides: Partial<RpcTransactionReceipt> & { transactionHash: Hex },
): RpcTransactionReceipt => ({
    blockHash: `0x${'11'.repeat(32)}`,
    blockNumber: '0x1',
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    effectiveGasPrice: GWEI,
    from: `0x${'00'.repeat(20)}`,
    gasUsed: '0x5208',
    logs: [],
    logsBloom: `0x${'00'.repeat(256)}`,
    status: '0x1',
    to: `0x${'00'.repeat(20)}`,
    transactionIndex: '0x0',
    type: '0x2',
    ...overrides,
})

type JsonRpcRequest = {
    jsonrpc: '2.0'
    id: number | string | null
    method: string
    params?: unknown[]
}

const isJsonRpcRequest = (value: unknown): value is JsonRpcRequest =>
    typeof value === 'object' &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (value as { method?: unknown }).method === 'string'

const errorReply = (id: JsonRpcRequest['id'], error: EvmRpcErrorFixture) => ({
    jsonrpc: '2.0',
    id,
    error: {
        code: error.code,
        message: error.message,
        ...(error.data !== undefined && { data: error.data }),
    },
})

const reply = (
    request: JsonRpcRequest,
    responses: Required<EvmRpcFixtures>['responses'],
) => {
    const responder = (
        responses as Record<string, EvmRpcResponder<EvmRpcMethod> | undefined>
    )[request.method]
    if (responder === undefined) {
        return errorReply(
            request.id,
            new EvmRpcErrorFixture(
                JSON_RPC_METHOD_NOT_FOUND,
                `Method ${request.method} has no fixture`,
            ),
        )
    }
    const outcome =
        typeof responder === 'function'
            ? responder(request.params ?? [])
            : responder
    return outcome instanceof EvmRpcErrorFixture
        ? errorReply(request.id, outcome)
        : { jsonrpc: '2.0', id: request.id, result: outcome }
}

/**
 * One POST handler that answers by JSON-RPC method, batches included. A
 * method without a fixture gets the node's own "method not found" error rather
 * than falling through to the network.
 */
export const evmRpcHandlers = ({
    rpcUrl = '*',
    responses,
}: EvmRpcFixtures = {}): RequestHandler[] => {
    const merged = { ...DEFAULT_EVM_RPC_RESPONSES, ...responses }
    return [
        http.post(rpcUrl, async ({ request }) => {
            const body: unknown = await request
                .clone()
                .json()
                .catch(() => undefined)
            const isBatch = Array.isArray(body)
            const entries: unknown[] = isBatch ? body : [body]
            // Returning nothing passes a non-JSON-RPC POST to the next handler.
            if (!entries.some(isJsonRpcRequest)) return undefined

            const replies = entries.map(entry =>
                isJsonRpcRequest(entry)
                    ? reply(entry, merged)
                    : errorReply(
                          null,
                          new EvmRpcErrorFixture(
                              JSON_RPC_INVALID_REQUEST,
                              'Invalid request',
                          ),
                      ),
            )
            return HttpResponse.json(isBatch ? replies : replies[0])
        }),
    ]
}

export type Erc20Fixture = {
    name: string
    symbol: string
    decimals: number
    /** Base units. */
    totalSupply: bigint
    /** Base units, keyed by checksummed holder; a holder left out has 0. */
    balances?: Record<string, bigint>
    /** Every call "succeeds" with empty return data, as a target with no code does. */
    noCode?: boolean
    /** Every call succeeds with fewer than 32 bytes of return data. */
    shortReturn?: boolean
}

const ERC20_READS = {
    name: (token: Erc20Fixture) =>
        encodeAbiParameters([{ type: 'string' }], [token.name]),
    symbol: (token: Erc20Fixture) =>
        encodeAbiParameters([{ type: 'string' }], [token.symbol]),
    decimals: (token: Erc20Fixture) =>
        encodeAbiParameters([{ type: 'uint8' }], [token.decimals]),
    totalSupply: (token: Erc20Fixture) =>
        encodeAbiParameters([{ type: 'uint256' }], [token.totalSupply]),
} as const

const ERC20_SELECTORS = Object.entries(ERC20_READS).map(
    ([name, encode]) => [toFunctionSelector(`${name}()`), encode] as const,
)

const BALANCE_OF_SELECTOR = toFunctionSelector('balanceOf(address)')

/** The encoded answer, or null where the contract would revert. */
const answerErc20Call = (
    tokens: Record<string, Erc20Fixture>,
    to: Hex,
    data: Hex,
): Hex | null => {
    const token = tokens[getAddress(to)]
    if (!token) return null
    if (token.noCode) return '0x'
    if (token.shortReturn) return `0x${'00'.repeat(16)}`
    if (data.startsWith(BALANCE_OF_SELECTOR)) {
        const [holder] = decodeAbiParameters(
            [{ type: 'address' }],
            `0x${data.slice(BALANCE_OF_SELECTOR.length)}`,
        )
        return encodeAbiParameters(
            [{ type: 'uint256' }],
            [token.balances?.[getAddress(holder)] ?? 0n],
        )
    }
    const encode = ERC20_SELECTORS.find(([selector]) =>
        data.startsWith(selector),
    )?.[1]
    return encode ? encode(token) : null
}

const answerAggregate3 = (
    tokens: Record<string, Erc20Fixture>,
    data: Hex,
): Hex => {
    const { args } = decodeFunctionData({ abi: multicall3Abi, data })
    const calls = args[0] as readonly { target: Hex; callData: Hex }[]
    return encodeFunctionResult({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        result: calls.map(({ target, callData }) => {
            const returnData = answerErc20Call(tokens, target, callData)
            return {
                success: returnData !== null,
                returnData: returnData ?? '0x',
            }
        }),
    })
}

/**
 * `eth_call` answers for ERC-20 metadata and `balanceOf` reads, keyed by
 * checksummed contract, direct or through Multicall3 `aggregate3`; anything
 * else reverts.
 */
export const erc20CallResponder =
    (
        tokens: Record<string, Erc20Fixture>,
    ): ((params: readonly unknown[]) => Hex | EvmRpcErrorFixture) =>
    params => {
        const { to, data } = params[0] as { to: Hex; data: Hex }
        if (isAddressEqual(to, MULTICALL3_ADDRESS)) {
            return answerAggregate3(tokens, data)
        }
        return (
            answerErc20Call(tokens, to, data) ??
            new EvmRpcErrorFixture(3, 'execution reverted')
        )
    }
