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
    decodeFunctionData,
    encodeFunctionData,
    erc20Abi,
    getAddress,
    isAddress,
    parseAbi,
    size,
    slice,
    toFunctionSelector,
    zeroAddress,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
    isNativeAsset,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { toBigInt, type Nullable } from '@perawallet/wallet-core-shared'
import {
    SwapQuoteMismatchError,
    type SwapQuoteRequest,
} from '@perawallet/wallet-core-swaps'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { toAllowanceAmount } from '../signing/allowance'
import { decodeEvmStandardCall } from '../signing/standard-calls'
import type { EvmSwapCall } from './decode-swap-transaction'

/** A plan that passed {@link validateEvmSwapTransactions}. */
export type EvmSwapPlan = {
    approval: Nullable<EvmSwapCall>
    swap: EvmSwapCall
    /** The contract the swap calls, or the provider's deposit address. */
    counterparty: Address
    /** A deposit: the provider swaps on its side and pays out after it lands. */
    isPaidOutLater: boolean
}

const MAX_SWAP_CALLS = 2
const SELECTOR_SIZE = 4
// Each runs its inner calls as the caller, so each inner call is checked too.
const MULTICALL_ABI = parseAbi([
    'function multicall(bytes[] data)',
    'function multicall(uint256 deadline, bytes[] data)',
    'function multicall(bytes32 previousBlockhash, bytes[] data)',
])
const MULTICALL_SELECTORS: ReadonlySet<Hex> = new Set(
    MULTICALL_ABI.map(item => toFunctionSelector(item)),
)
const MAX_MULTICALL_DEPTH = 3

/**
 * Calls that move or grant the caller's assets with no allowance, whatever the
 * contract. The swap's contract changes per order, so this is the wallet's own
 * guard over what it can recognise; it can't be complete, and XO's and Pera's
 * backends check each order too.
 */
const REFUSED_SELECTORS: ReadonlySet<Hex> = new Set(
    [
        // Tokens and NFTs
        'approve(address,uint256)',
        'transfer(address,uint256)',
        'transferFrom(address,address,uint256)',
        'setApprovalForAll(address,bool)',
        'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)',
        'permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)',
        'safeTransferFrom(address,address,uint256)',
        'safeTransferFrom(address,address,uint256,bytes)',
        'safeTransferFrom(address,address,uint256,uint256,bytes)',
        'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
        'increaseAllowance(address,uint256)',
        // Permit2
        'approve(address,address,uint160,uint48)',
        // ERC-677 and ERC-1363
        'transferAndCall(address,uint256)',
        'transferAndCall(address,uint256,bytes)',
        'transferFromAndCall(address,address,uint256)',
        'transferFromAndCall(address,address,uint256,bytes)',
        'approveAndCall(address,uint256)',
        'approveAndCall(address,uint256,bytes)',
        // ERC-777
        'send(address,uint256,bytes)',
        'operatorSend(address,address,uint256,bytes,bytes)',
        'authorizeOperator(address)',
        // Bridges that burn the caller's bridged tokens: OP Stack, Arbitrum
        'withdraw(address,uint256,uint32,bytes)',
        'withdrawTo(address,address,uint256,uint32,bytes)',
        'bridgeERC20(address,address,uint256,uint32,bytes)',
        'bridgeERC20To(address,address,address,uint256,uint32,bytes)',
        'outboundTransfer(address,address,uint256,bytes)',
        'withdrawTo(address,uint256)',
        // Vault shares and lending positions: ERC-4626, Aave, Compound v3
        'redeem(uint256,address,address)',
        'withdraw(uint256,address,address)',
        'withdraw(address,uint256,address)',
        'withdrawTo(address,address,uint256)',
        'withdrawFrom(address,address,address,uint256)',
        'transferAsset(address,address,uint256)',
        'allow(address,bool)',
        // LP positions: Uniswap V3 and V4
        'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))',
        'collect((uint256,address,uint128,uint128))',
        'modifyLiquidities(bytes,uint256)',
        'modifyLiquiditiesWithoutUnlock(bytes,bytes[])',
        // Ownership the account holds: ENS names, contracts it deployed
        'setOwner(bytes32,address)',
        'transferOwnership(address)',
    ].map(signature => toFunctionSelector(signature)),
)

const refuse: (reason: string) => never = reason => {
    throw new SwapQuoteMismatchError(reason)
}

// A mixed-case selector would slip past a set of viem's lowercase ones.
const selectorOf = (data: Hex): Nullable<Hex> =>
    size(data) >= SELECTOR_SIZE
        ? (slice(data, 0, SELECTOR_SIZE).toLowerCase() as Hex)
        : null

const assertNoRefusedCall = (data: Hex, depth = 0): void => {
    const selector = selectorOf(data)
    if (selector === null) return
    if (REFUSED_SELECTORS.has(selector)) {
        refuse('A swap transaction moves or grants assets by itself')
    }
    if (!MULTICALL_SELECTORS.has(selector)) return
    if (depth >= MAX_MULTICALL_DEPTH) {
        refuse('A swap transaction nests multicalls too deep')
    }
    let inner: readonly Hex[]
    try {
        const { args } = decodeFunctionData({ abi: MULTICALL_ABI, data })
        inner = args[args.length - 1] as readonly Hex[]
    } catch {
        return refuse('A swap multicall is unreadable')
    }
    inner.forEach(call => assertNoRefusedCall(call, depth + 1))
}

const assertApproval = (
    approval: EvmSwapCall,
    {
        token,
        swap,
        sender,
        amount,
    }: {
        token: Nullable<Address>
        swap: EvmSwapCall
        sender: Address
        amount: bigint
    },
): void => {
    if (token === null) {
        return refuse('A swap of the native asset needs no approval')
    }
    const standard = decodeEvmStandardCall({ ...approval, from: sender })
    if (standard?.kind !== 'approve') {
        return refuse('A call before the swap is not an approval')
    }
    if (!areEvmAddressesEqual(standard.contract, token)) {
        refuse('The approval is not for the asset being swapped')
    }
    if (!areEvmAddressesEqual(standard.spender, swap.to)) {
        refuse('The approval is not for the contract the swap calls')
    }
    const units = toBigInt(standard.value)
    if (toAllowanceAmount(units) === undefined || units > amount) {
        refuse('The approval is for more than the swap')
    }
}

/**
 * The recipient of a token deposit, or null when `call` isn't a `transfer` on
 * the source token. A deposit is exactly the swap amount, to an address that is
 * neither zero nor the sender, and re-encodes to the same bytes: USDT ignores
 * dirty upper address bytes and trailing data, so the token won't catch them.
 */
const tokenDepositRecipientOf = (
    call: EvmSwapCall,
    {
        token,
        sender,
        amount,
    }: { token: Address; sender: Address; amount: bigint },
): Nullable<Address> => {
    if (!areEvmAddressesEqual(call.to, token)) return null
    let recipient: Address
    let value: bigint
    try {
        const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data })
        if (decoded.functionName !== 'transfer') return null
        ;[recipient, value] = decoded.args
    } catch {
        return null
    }
    const exact = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient, value],
    })
    if (exact !== call.data.toLowerCase()) {
        refuse('The deposit transfer is not strictly encoded')
    }
    if (call.value !== 0n) refuse('The deposit transfer sends native value')
    if (value !== amount) refuse('The deposit is not for the swap amount')
    if (
        areEvmAddressesEqual(recipient, zeroAddress) ||
        areEvmAddressesEqual(recipient, sender)
    ) {
        refuse('The deposit goes nowhere or back to the sender')
    }
    return getAddress(recipient)
}

/**
 * Throws {@link SwapQuoteMismatchError} unless `calls` keep to `request`'s
 * shape on the same chain: a deposit (one exact `transfer` of the source token,
 * or one plain send of at most the native amount), or at most an approval of the
 * source token for this amount to the swap's contract, then the swap, last. XO
 * names a different contract and deposit address per order, so those and the
 * swap's arguments are trusted to XO and checked by its and Pera's backends; the
 * wallet refuses the calls it can see move the account's assets by themselves.
 * Anything it doesn't list passes: a call on a protocol where the account holds
 * a position (a vault, a lending pool, an LP) can move that position, as can a
 * contract the account already gave a larger allowance.
 */
export const validateEvmSwapTransactions = ({
    calls,
    request,
    scope,
    chain,
}: {
    calls: readonly EvmSwapCall[]
    request: SwapQuoteRequest
    scope: ChainScope
    chain: EvmChain
}): EvmSwapPlan => {
    const { sourceAsset, sourceAddress, sourceAmount } = request
    if (calls.length === 0 || calls.length > MAX_SWAP_CALLS) {
        refuse(`An order of ${calls.length} transactions is not a swap`)
    }
    if (sourceAsset.chainId !== chain.row.id) {
        refuse('The swap does not pay from this chain')
    }
    const isNative = isNativeAsset(sourceAsset, chain.descriptor)
    if (!isNative && !isAddress(sourceAsset.assetId)) {
        refuse('The swap pays with an asset this chain cannot name')
    }
    const chainId = eip155ChainIdOf(scope, chain)
    if (calls.some(call => call.chainId !== chainId)) {
        refuse('A swap transaction is for another chain')
    }

    const token = isNative ? null : getAddress(sourceAsset.assetId)
    const sender = getAddress(sourceAddress)
    const amount = toBigInt(sourceAmount)
    const swap = calls[calls.length - 1]
    const approval = calls.length === MAX_SWAP_CALLS ? calls[0] : null

    if (token !== null && !approval) {
        const recipient = tokenDepositRecipientOf(swap, {
            token,
            sender,
            amount,
        })
        if (recipient) {
            return {
                approval: null,
                swap,
                counterparty: recipient,
                isPaidOutLater: true,
            }
        }
    }

    // The approval has its own, exact check below.
    assertNoRefusedCall(swap.data)
    if (swap.value > (isNative ? amount : 0n)) {
        refuse('The swap sends more of the native asset than requested')
    }
    if (selectorOf(swap.data) === null) {
        if (!isNative || approval) {
            refuse('The last transaction is not the swap')
        }
        return {
            approval: null,
            swap,
            counterparty: swap.to,
            isPaidOutLater: true,
        }
    }
    if (token !== null && areEvmAddressesEqual(swap.to, token)) {
        refuse('The swap calls the asset being swapped')
    }
    if (approval) {
        assertApproval(approval, { token, swap, sender, amount })
    }
    return { approval, swap, counterparty: swap.to, isPaidOutLater: false }
}
