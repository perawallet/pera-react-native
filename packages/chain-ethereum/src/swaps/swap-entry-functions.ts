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

import { toFunctionSelector } from 'viem'
import type { Hex } from 'viem'

/**
 * The functions a swap transaction may call, from the verified ABIs of each
 * aggregator's Ethereum router. XO picks the contract per order, so the
 * function is what's pinned: a contract that can move the caller's assets
 * without an allowance (a bridge, a vault, a lending pool, an LP position)
 * has none of these, so it can't be the swap.
 *
 * Generic names stay out even when a router has them: `multicall(bytes[])` is
 * also the Uniswap position manager's, which collects an LP position to any
 * recipient. So do permit variants (they need the user's off-chain signature,
 * which an order can't carry), callbacks, limit-order fills and admin calls.
 */
const SWAP_ENTRY_SIGNATURES = [
    // Uniswap V2 Router02 and its forks
    'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
    'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)',
    'swapExactETHForTokens(uint256,address[],address,uint256)',
    'swapTokensForExactETH(uint256,uint256,address[],address,uint256)',
    'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
    'swapETHForExactTokens(uint256,address[],address,uint256)',
    'swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
    'swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)',
    'swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
    // Uniswap V3 SwapRouter
    'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
    'exactInput((bytes,address,uint256,uint256,uint256))',
    'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
    'exactOutput((bytes,address,uint256,uint256,uint256))',
    // Uniswap SwapRouter02
    'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',
    'exactInput((bytes,address,uint256,uint256))',
    'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))',
    'exactOutput((bytes,address,uint256,uint256))',
    'swapExactTokensForTokens(uint256,uint256,address[],address)',
    'swapTokensForExactTokens(uint256,uint256,address[],address)',
    'multicall(uint256,bytes[])',
    'multicall(bytes32,bytes[])',
    // Uniswap Universal Router (V2, V3 and V4 pools)
    'execute(bytes,bytes[],uint256)',
    'execute(bytes,bytes[])',
    // 1inch Aggregation Router V5
    'swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)',
    'unoswap(address,uint256,uint256,uint256[])',
    'unoswapTo(address,address,uint256,uint256,uint256[])',
    'uniswapV3Swap(uint256,uint256,uint256[])',
    'uniswapV3SwapTo(address,uint256,uint256,uint256[])',
    'clipperSwap(address,address,address,uint256,uint256,uint256,bytes32,bytes32)',
    'clipperSwapTo(address,address,address,address,uint256,uint256,uint256,bytes32,bytes32)',
    // 1inch Aggregation Router V6
    'swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)',
    'unoswap(uint256,uint256,uint256,uint256)',
    'unoswap2(uint256,uint256,uint256,uint256,uint256)',
    'unoswap3(uint256,uint256,uint256,uint256,uint256,uint256)',
    'unoswapTo(uint256,uint256,uint256,uint256,uint256)',
    'unoswapTo2(uint256,uint256,uint256,uint256,uint256,uint256)',
    'unoswapTo3(uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
    'ethUnoswap(uint256,uint256)',
    'ethUnoswap2(uint256,uint256,uint256)',
    'ethUnoswap3(uint256,uint256,uint256,uint256)',
    'ethUnoswapTo(uint256,uint256,uint256)',
    'ethUnoswapTo2(uint256,uint256,uint256,uint256)',
    'ethUnoswapTo3(uint256,uint256,uint256,uint256,uint256)',
    'clipperSwap(address,uint256,address,uint256,uint256,uint256,bytes32,bytes32)',
    'clipperSwapTo(address,address,uint256,address,uint256,uint256,uint256,bytes32,bytes32)',
    // 0x: AllowanceHolder for a token source, Settler directly for ETH
    'exec(address,address,uint256,address,bytes)',
    'execute((address,address,uint256),bytes[],bytes32)',
    // ParaSwap (Velora) Augustus V6
    'swapExactAmountIn(address,(address,address,uint256,uint256,uint256,bytes32,address),uint256,bytes,bytes)',
    'swapExactAmountOut(address,(address,address,uint256,uint256,uint256,bytes32,address),uint256,bytes,bytes)',
    'swapExactAmountInOnUniswapV2((address,address,uint256,uint256,uint256,bytes32,address,bytes),uint256,bytes)',
    'swapExactAmountOutOnUniswapV2((address,address,uint256,uint256,uint256,bytes32,address,bytes),uint256,bytes)',
    'swapExactAmountInOnUniswapV3((address,address,uint256,uint256,uint256,bytes32,address,bytes),uint256,bytes)',
    'swapExactAmountOutOnUniswapV3((address,address,uint256,uint256,uint256,bytes32,address,bytes),uint256,bytes)',
    'swapExactAmountInOnBalancerV2((uint256,uint256,uint256,bytes32,uint256),uint256,bytes,bytes)',
    'swapExactAmountOutOnBalancerV2((uint256,uint256,uint256,bytes32,uint256),uint256,bytes,bytes)',
    'swapExactAmountInOnCurveV1((uint256,uint256,address,address,uint256,uint256,uint256,bytes32,address),uint256,bytes)',
    'swapExactAmountInOnCurveV2((uint256,uint256,uint256,address,address,address,uint256,uint256,uint256,bytes32,address),uint256,bytes)',
    'swapOnAugustusRFQTryBatchFill((uint256,uint256,uint8,bytes32,address),((uint256,uint128,address,address,address,address,uint256,uint256),bytes,uint256,bytes,bytes)[],bytes)',
    // KyberSwap MetaAggregationRouterV2
    'swap((address,address,bytes,(address,address,address[],uint256[],address[],uint256[],address,uint256,uint256,uint256,bytes),bytes))',
    'swapGeneric((address,address,bytes,(address,address,address[],uint256[],address[],uint256[],address,uint256,uint256,uint256,bytes),bytes))',
    'swapSimpleMode(address,(address,address,address[],uint256[],address[],uint256[],address,uint256,uint256,uint256,bytes),bytes,bytes)',
    // Odos Router V2
    'swap((address,uint256,address,address,uint256,uint256,address),bytes,address,uint32)',
    'swapCompact()',
    'swapMulti((address,uint256,address)[],(address,uint256,address)[],uint256,bytes,address,uint32)',
    'swapMultiCompact()',
    // OKX DEX Router
    'smartSwapByOrderId(uint256,(uint256,address,uint256,uint256,uint256),uint256[],(address[],address[],uint256[],bytes[],uint256)[][],(uint256,address,address,address,uint256,uint256,uint256,uint256,bool,bytes)[])',
    'smartSwapTo(uint256,address,(uint256,address,uint256,uint256,uint256),uint256[],(address[],address[],uint256[],bytes[],uint256)[][],(uint256,address,address,address,uint256,uint256,uint256,uint256,bool,bytes)[])',
    'unxswapByOrderId(uint256,uint256,uint256,bytes32[])',
    'unxswapTo(uint256,uint256,uint256,address,bytes32[])',
    'uniswapV3SwapTo(uint256,uint256,uint256,uint256[])',
    'swapWrap(uint256,uint256)',
] as const

export const SWAP_ENTRY_SELECTORS: ReadonlySet<Hex> = new Set(
    SWAP_ENTRY_SIGNATURES.map(signature => toFunctionSelector(signature)),
)
