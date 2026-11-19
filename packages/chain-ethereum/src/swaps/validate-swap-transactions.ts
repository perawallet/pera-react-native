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

import { getAddress, isAddress, size, slice, toFunctionSelector } from 'viem'
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
}

const MAX_SWAP_CALLS = 2
const SELECTOR_SIZE = 4

const APPROVE_SELECTORS: ReadonlySet<Hex> = new Set([
    toFunctionSelector('approve(address,uint256)'),
])

// Each moves or grants a token the sender holds, past what the swap's own
// amount bounds. The swap's `to` is unpinned, so this list is what stops a call
// into any token the account holds, not just the source.
const REFUSED_SWAP_SELECTORS: ReadonlySet<Hex> = new Set(
    [
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
    ].map(signature => toFunctionSelector(signature)),
)

const refuse: (reason: string) => never = reason => {
    throw new SwapQuoteMismatchError(reason)
}

const selectorOf = (call: EvmSwapCall): Nullable<Hex> =>
    size(call.data) >= SELECTOR_SIZE ? slice(call.data, 0, SELECTOR_SIZE) : null

// A mixed-case selector would slip past a set of viem's lowercase ones.
const hasSelector = (
    call: EvmSwapCall,
    selectors: ReadonlySet<Hex>,
): boolean => {
    const selector = selectorOf(call)
    return selector !== null && selectors.has(selector.toLowerCase() as Hex)
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
 * Throws {@link SwapQuoteMismatchError} unless `calls` keep to `request`'s
 * shape: the same chain, at most an approval of the source token for this
 * amount to the swap's contract, then the swap, last. XO names a different
 * contract per order, so the swap's `to` and calldata are trusted to XO: its
 * recipient, input amount, minimum output, and what it pulls through an
 * allowance the account already gave that contract.
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
    if (calls.some(call => hasSelector(call, REFUSED_SWAP_SELECTORS))) {
        refuse('A swap transaction moves assets by itself')
    }

    const swap = calls[calls.length - 1]
    const approval = calls.length === MAX_SWAP_CALLS ? calls[0] : null
    if (selectorOf(swap) === null || hasSelector(swap, APPROVE_SELECTORS)) {
        refuse('The last transaction is not the swap')
    }
    const token = isNative ? null : getAddress(sourceAsset.assetId)
    // With `to` unpinned, a call into the token itself could move it in a way
    // the selector denylist doesn't name.
    if (token && areEvmAddressesEqual(swap.to, token)) {
        refuse('The swap calls the asset being swapped')
    }

    const amount = toBigInt(sourceAmount)
    if (swap.value > (isNative ? amount : 0n)) {
        refuse('The swap sends more of the native asset than requested')
    }
    if (approval) {
        assertApproval(approval, {
            token,
            swap,
            sender: getAddress(sourceAddress),
            amount,
        })
    }
    return { approval, swap }
}
