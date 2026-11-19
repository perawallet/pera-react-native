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

import { getAddress, isAddress, size, slice } from 'viem'
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
import { SWAP_ENTRY_SELECTORS } from './swap-entry-functions'

/** A plan that passed {@link validateEvmSwapTransactions}. */
export type EvmSwapPlan = {
    approval: Nullable<EvmSwapCall>
    swap: EvmSwapCall
}

const MAX_SWAP_CALLS = 2
const SELECTOR_SIZE = 4

const refuse: (reason: string) => never = reason => {
    throw new SwapQuoteMismatchError(reason)
}

// A mixed-case selector would miss a set of viem's lowercase ones.
const isSwapEntry = ({ data }: EvmSwapCall): boolean =>
    size(data) >= SELECTOR_SIZE &&
    SWAP_ENTRY_SELECTORS.has(slice(data, 0, SELECTOR_SIZE).toLowerCase() as Hex)

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
 * amount to the swap's contract, then the swap, last, calling a known
 * aggregator function ({@link SWAP_ENTRY_SELECTORS}). XO names a different
 * contract per order, so the contract and the swap's arguments are trusted to
 * XO: its recipient, input amount, minimum output, and what it pulls through an
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

    const swap = calls[calls.length - 1]
    const approval = calls.length === MAX_SWAP_CALLS ? calls[0] : null
    if (!isSwapEntry(swap)) {
        refuse('The last transaction calls no known swap function')
    }
    const token = isNative ? null : getAddress(sourceAsset.assetId)
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
