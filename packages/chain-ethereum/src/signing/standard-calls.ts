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
    decodeFunctionData,
    encodeFunctionData,
    getAddress,
    parseAbi,
    size,
    slice,
    toFunctionSelector,
} from 'viem'
import type { AbiFunction, Address, Hex } from 'viem'
import {
    i18nKey,
    type ReviewWarning,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { toEvmNftAssetId } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { sendSummary } from '../transfer/summary'
import { toAllowanceAmount } from './allowance'
import type { EvmNftItem, EvmStandardCall } from './standard-call-types'

const SELECTOR_SIZE = 4

const APPROVAL_TITLE_KEY = i18nKey('transactions.list_item.approval')
const REVOKE_APPROVAL_TITLE_KEY = i18nKey(
    'transactions.list_item.revoke_approval',
)

const STANDARD_FUNCTIONS = parseAbi([
    'function transfer(address to, uint256 value)',
    'function transferFrom(address from, address to, uint256 value)',
    'function safeTransferFrom(address from, address to, uint256 tokenId)',
    'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
    'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] values, bytes data)',
    'function approve(address spender, uint256 value)',
    'function increaseAllowance(address spender, uint256 addedValue)',
    'function setApprovalForAll(address operator, bool approved)',
])

const BY_SELECTOR = new Map<Hex, AbiFunction>(
    STANDARD_FUNCTIONS.map(item => [toFunctionSelector(item), item]),
)

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

const toCall = (
    item: AbiFunction,
    args: readonly unknown[],
    from: Address,
    contract: Address,
): Optional<EvmStandardCall> => {
    const address = (index: number) => getAddress(args[index] as Address)
    const uint = (index: number) => args[index] as bigint
    switch (item.name) {
        case 'transfer': {
            return {
                kind: 'transfer',
                contract,
                from,
                to: address(0),
                value: toDecimal(uint(1)),
            }
        }
        case 'transferFrom': {
            return {
                kind: 'transfer-from',
                contract,
                from: address(0),
                to: address(1),
                value: toDecimal(uint(2)),
            }
        }
        case 'safeTransferFrom': {
            return item.inputs.length === 5
                ? {
                      kind: 'erc1155-transfer',
                      contract,
                      from: address(0),
                      to: address(1),
                      items: [
                          {
                              tokenId: uint(2).toString(),
                              amount: toDecimal(uint(3)),
                          },
                      ],
                  }
                : {
                      kind: 'erc721-safe-transfer',
                      contract,
                      from: address(0),
                      to: address(1),
                      tokenId: uint(2).toString(),
                  }
        }
        case 'safeBatchTransferFrom': {
            const ids = args[2] as readonly bigint[]
            const amounts = args[3] as readonly bigint[]
            // The contract reverts on either, so neither is a transfer to show.
            if (ids.length === 0 || ids.length !== amounts.length) {
                return undefined
            }
            return {
                kind: 'erc1155-transfer',
                contract,
                from: address(0),
                to: address(1),
                items: ids.map((id, index): EvmNftItem => ({
                    tokenId: id.toString(),
                    amount: toDecimal(amounts[index]),
                })),
            }
        }
        case 'approve': {
            return {
                kind: 'approve',
                contract,
                spender: address(0),
                value: toDecimal(uint(1)),
            }
        }
        case 'increaseAllowance': {
            return {
                kind: 'increase-allowance',
                contract,
                spender: address(0),
                value: toDecimal(uint(1)),
            }
        }
        case 'setApprovalForAll': {
            return {
                kind: 'set-approval-for-all',
                contract,
                operator: address(0),
                isApproved: args[1] as boolean,
            }
        }
        default: {
            return undefined
        }
    }
}

/**
 * The standard token function a call makes, or undefined unless its calldata
 * re-encodes byte for byte as that function, it names a contract and it
 * sends no ether. A lenient decoder would accept dirty padding or trailing
 * bytes the contract might read differently. Never throws.
 */
export const decodeEvmStandardCall = (call: {
    from: Address
    to?: Address
    data: Hex
    value: bigint
}): Optional<EvmStandardCall> => {
    if (!call.to || call.value !== 0n || size(call.data) < SELECTOR_SIZE) {
        return undefined
    }
    const item = BY_SELECTOR.get(
        slice(call.data, 0, SELECTOR_SIZE).toLowerCase() as Hex,
    )
    if (!item) return undefined
    try {
        const { args = [] } = decodeFunctionData({
            abi: [item],
            data: call.data,
        })
        const encoded = encodeFunctionData({ abi: [item], args })
        if (encoded.toLowerCase() !== call.data.toLowerCase()) return undefined
        return toCall(item, args, getAddress(call.from), getAddress(call.to))
    } catch {
        return undefined
    }
}

/**
 * An approval carries its own warning, so it is read whatever the chain's
 * capabilities. A transfer isn't: a selector match proves the encoding, not
 * that the target is a token, so it is read only while `contractDecoding` is on.
 */
export const isEvmApprovalCall = (call: EvmStandardCall): boolean =>
    call.kind === 'approve' ||
    call.kind === 'increase-allowance' ||
    call.kind === 'set-approval-for-all'

const isRevocation = (call: EvmStandardCall): boolean =>
    (call.kind === 'approve' && call.value.isZero()) ||
    (call.kind === 'set-approval-for-all' && !call.isApproved)

const approvalSummary = (
    call: EvmStandardCall,
    counterparty: Address,
): TransactionSummary => ({
    kind: 'approval',
    title: {
        key: isRevocation(call)
            ? REVOKE_APPROVAL_TITLE_KEY
            : APPROVAL_TITLE_KEY,
    },
    direction: 'none',
    counterparty,
    icon: 'approval',
})

/** What a standard call does, as review and analysis read it. */
export const standardCallSummary = (
    call: EvmStandardCall,
    chain: EvmChain,
): TransactionSummary => {
    const chainId = chain.row.id
    switch (call.kind) {
        case 'approve':
        case 'increase-allowance': {
            return approvalSummary(call, call.spender)
        }
        case 'set-approval-for-all': {
            return approvalSummary(call, call.operator)
        }
        case 'transfer':
        case 'transfer-from': {
            return sendSummary('token-transfer', call.from, call.to, {
                assetRef: { chainId, assetId: call.contract },
                value: call.value,
            })
        }
        case 'erc721-safe-transfer': {
            return sendSummary('nft-transfer', call.from, call.to, {
                assetRef: {
                    chainId,
                    assetId: toEvmNftAssetId(call.contract, call.tokenId),
                },
                value: new Decimal(1),
            })
        }
        case 'erc1155-transfer': {
            const changes = call.items.map(item => ({
                assetRef: {
                    chainId,
                    assetId: toEvmNftAssetId(call.contract, item.tokenId),
                },
                value: item.amount,
            }))
            const summary = sendSummary(
                'nft-transfer',
                call.from,
                call.to,
                changes[0],
            )
            return changes.length === 1
                ? summary
                : {
                      ...summary,
                      balanceChanges: changes.map(change => ({
                          ...change,
                          value: change.value.negated(),
                      })),
                  }
        }
    }
}

const UNLIMITED_APPROVAL_WARNING: ReviewWarning = {
    type: 'token-approval',
    severity: 'danger',
    message:
        'This lets another address take all of this token you hold, until you revoke it.',
}

const COLLECTION_APPROVAL_WARNING: ReviewWarning = {
    type: 'token-approval',
    severity: 'danger',
    message:
        'This lets another address transfer every item you hold in this collection, until you revoke it.',
}

const LIMITED_APPROVAL_WARNING: ReviewWarning = {
    type: 'token-approval',
    severity: 'warning',
    message:
        'This lets another address move some of this token out of your account without asking you again.',
}

/** Undefined for a revocation or a transfer: neither grants anything. */
export const approvalWarningOf = (
    call: EvmStandardCall,
): Optional<ReviewWarning> => {
    if (isRevocation(call)) return undefined
    switch (call.kind) {
        case 'approve':
        case 'increase-allowance': {
            return toAllowanceAmount(BigInt(call.value.toFixed())) === undefined
                ? { ...UNLIMITED_APPROVAL_WARNING }
                : { ...LIMITED_APPROVAL_WARNING }
        }
        case 'set-approval-for-all': {
            return { ...COLLECTION_APPROVAL_WARNING }
        }
        default: {
            return undefined
        }
    }
}
