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
    maxUint256,
    parseAbi,
    size,
    slice,
    toFunctionSelector,
} from 'viem'
import type { AbiFunction, Address, Hex } from 'viem'
import {
    i18nKey,
    type I18nKey,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import type { EvmChain } from '../chains/types'
import type { EvmContractAction } from './contract-action-types'
import type { KnownEvmContract } from './known-contracts'
import { decodeUniversalRouterSwap } from './universal-router'

type Call = { from: Address; to: Address; data: Hex; value: bigint }

const SELECTOR_SIZE = 4

const TITLE_KEYS: Record<EvmContractAction['kind'], I18nKey> = {
    swap: i18nKey('transactions.list_item.swap'),
    wrap: i18nKey('transactions.list_item.wrap'),
    unwrap: i18nKey('transactions.list_item.unwrap'),
    supply: i18nKey('transactions.list_item.supply'),
    withdraw: i18nKey('transactions.list_item.withdraw'),
    borrow: i18nKey('transactions.list_item.borrow'),
    repay: i18nKey('transactions.list_item.repay'),
}

const CONTRACT_CALL_ICON = 'contract-call'

const WRAPPED_NATIVE_FUNCTIONS = parseAbi([
    'function deposit()',
    'function withdraw(uint256 wad)',
])

const AAVE_POOL_FUNCTIONS = parseAbi([
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function supplyWithPermit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS)',
    'function withdraw(address asset, uint256 amount, address to)',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)',
    'function repayWithPermit(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS)',
])

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

// A lenient decoder would accept dirty padding or trailing bytes the contract
// might read differently, so the call must re-encode to exactly its calldata.
const readFunction = (
    functions: readonly AbiFunction[],
    data: Hex,
): Optional<{ name: string; args: readonly unknown[] }> => {
    if (size(data) < SELECTOR_SIZE) return undefined
    const selector = slice(data, 0, SELECTOR_SIZE).toLowerCase()
    const item = functions.find(
        candidate => toFunctionSelector(candidate) === selector,
    )
    if (!item) return undefined
    const { args = [] } = decodeFunctionData({ abi: [item], data })
    const encoded = encodeFunctionData({ abi: [item], args })
    return encoded.toLowerCase() === data.toLowerCase()
        ? { name: item.name, args }
        : undefined
}

const decodeWrappedNativeAction = (call: Call): Optional<EvmContractAction> => {
    const read = readFunction(WRAPPED_NATIVE_FUNCTIONS, call.data)
    if (read?.name === 'deposit' && call.value > 0n) {
        return { kind: 'wrap', amount: toDecimal(call.value) }
    }
    if (read?.name === 'withdraw' && call.value === 0n) {
        return { kind: 'unwrap', amount: toDecimal(read.args[0] as bigint) }
    }
    return undefined
}

const decodeAavePoolAction = (call: Call): Optional<EvmContractAction> => {
    const read = readFunction(AAVE_POOL_FUNCTIONS, call.data)
    if (!read || call.value !== 0n) return undefined
    const { name, args } = read
    const asset = getAddress(args[0] as Address)
    const amount = args[1] as bigint
    const isForSigner = (address: unknown) =>
        areEvmAddressesEqual(address as Address, call.from)
    const isEntireBalance = amount === maxUint256

    switch (name) {
        case 'supply':
        case 'supplyWithPermit': {
            // The pool reads the largest uint256 as "whatever the signer holds" only for withdraw and repay.
            return isForSigner(args[2]) && !isEntireBalance
                ? {
                      kind: 'supply',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        case 'withdraw': {
            return isForSigner(args[2])
                ? {
                      kind: 'withdraw',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        case 'borrow': {
            return isForSigner(args[4]) && !isEntireBalance
                ? {
                      kind: 'borrow',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        case 'repay':
        case 'repayWithPermit': {
            return isForSigner(args[3])
                ? {
                      kind: 'repay',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        default: {
            return undefined
        }
    }
}

/**
 * What a call to a known contract does, or undefined unless its calldata
 * decodes exactly to an action this knows. Never throws.
 */
export const decodeEvmContractAction = (
    call: Call,
    contract: KnownEvmContract,
    wrappedNative: Optional<Address>,
): Optional<EvmContractAction> => {
    try {
        switch (contract.kind) {
            case 'uniswap-universal-router': {
                return decodeUniversalRouterSwap(call, wrappedNative)
            }
            case 'wrapped-native': {
                return decodeWrappedNativeAction(call)
            }
            case 'aave-v3-pool': {
                return decodeAavePoolAction(call)
            }
            case 'uniswap-permit2':
            case 'uniswap-v3-position-manager':
            case 'uniswap-v4-position-manager': {
                return undefined
            }
        }
    } catch {
        return undefined
    }
}

/** The review and history title for an action: `transactions.list_item.<kind>`. */
export const contractActionTitleKeyOf = (action: EvmContractAction): I18nKey =>
    TITLE_KEYS[action.kind]

/**
 * Whether a decoded action stands in for the unknown-contract notice. A swap
 * that pays a third party out of its output doesn't: the notice stays beside
 * the fee, so a fee can never be what silences it.
 */
export const hidesUnknownContractNotice = (
    action: Optional<EvmContractAction>,
): boolean => !!action && (action.kind !== 'swap' || action.fees.length === 0)

/** A contract call's summary, titled for what its calldata proves it does. */
export const contractActionSummary = (
    action: EvmContractAction,
    call: { from: Address; to?: Address; data: Hex; value: bigint },
    chain: EvmChain,
): TransactionSummary => ({
    kind: action.kind === 'swap' ? 'swap' : 'contract-call',
    title: { key: contractActionTitleKeyOf(action) },
    direction: call.value > 0n ? 'out' : 'none',
    ...(call.to && { counterparty: call.to }),
    ...(call.value > 0n && {
        amount: {
            assetRef: chain.descriptor.nativeAsset.ref,
            value: toDecimal(call.value),
        },
    }),
    icon: action.kind === 'swap' ? 'swap' : CONTRACT_CALL_ICON,
})
