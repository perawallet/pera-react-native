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
    encodeFunctionData,
    erc20Abi,
    erc721Abi,
    getAddress,
    isAddress,
    type Address,
    type Hex,
} from 'viem'
import type {
    TokenApproval,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import type { EvmChain } from '../chains/types'
import { standardCallSummary } from '../signing/standard-calls'

export type EvmApprovalRevoke = {
    /** The token's or collection's contract. */
    to: Address
    data: Hex
    summary: TransactionSummary
}

/**
 * The call that withdraws `approval`: `approve(spender, 0)` for an
 * allowance, `setApprovalForAll(operator, false)` for a collection. Zero is
 * the only value set, since tokens such as USDT reject moving one non-zero
 * allowance to another but accept zero.
 */
export const toEvmApprovalRevoke = (
    approval: TokenApproval,
    chain: EvmChain,
): EvmApprovalRevoke => {
    const contractId =
        approval.kind === 'allowance'
            ? approval.assetRef.assetId
            : approval.collection
    if (
        !isAddress(approval.spender) ||
        !isAddress(contractId) ||
        (approval.kind === 'allowance' &&
            approval.assetRef.chainId !== chain.row.id)
    ) {
        throw new InvalidSendParamsError()
    }
    const spender = getAddress(approval.spender)
    const contract = getAddress(contractId)
    if (approval.kind === 'allowance') {
        return {
            to: contract,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [spender, 0n],
            }),
            summary: standardCallSummary(
                { kind: 'approve', contract, spender, value: new Decimal(0) },
                chain,
            ),
        }
    }
    return {
        to: contract,
        data: encodeFunctionData({
            abi: erc721Abi,
            functionName: 'setApprovalForAll',
            args: [spender, false],
        }),
        summary: standardCallSummary(
            {
                kind: 'set-approval-for-all',
                contract,
                operator: spender,
                isApproved: false,
            },
            chain,
        ),
    }
}
