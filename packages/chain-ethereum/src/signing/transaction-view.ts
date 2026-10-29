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
import { isAddress, isHex } from 'viem'
import type { Address, Hex } from 'viem'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { EvmNftStandard } from '../blockchain/utils/caip19'
import { isRecord } from './adapter'
import type { EvmStandardCall } from './standard-call-types'

/** An Ethereum transaction as review and detail screens read it. */
export type EthereumTransactionView = EthereumTransactionViewBase &
    (EthereumPricedView | EthereumPreviewView)

/** The nonce, gas and fees the signature commits to. */
export type EthereumPricedView = {
    isPreview?: false
    nonce: number
    gas: bigint
    /** Wei. `maxFee` is `gas * maxFeePerGas`, the most the signature authorises. */
    fee: {
        maxFeePerGas: Decimal
        maxPriorityFeePerGas: Decimal
        maxFee: Decimal
    }
}

/**
 * A later transaction of a batch, reviewed before it can be priced: its nonce,
 * gas and fees are set only once the one before it has landed.
 */
export type EthereumPreviewView = { isPreview: true }

type EthereumTransactionViewBase = {
    kind: 'transfer' | 'token-transfer' | 'nft-transfer' | 'contract-call'
    from: Address
    /** Absent for a contract creation. */
    to?: Address
    /** Wei. */
    value: Decimal
    /** Calldata as sent; `'0x'` when empty. */
    data: Hex
    /** First four bytes of `data`; absent when `data` is shorter. */
    selector?: Hex
    /** Only on a verified token transfer; `amount` in the token's base units. */
    token?: { contract: Address; to: Address; amount: Decimal }
    /**
     * Only on a verified NFT transfer. `assetId` is the app's NFT id, `tokenId`
     * a decimal uint256 and `amount` the quantity in base units, which an NFT's
     * zero decimals make its display units too.
     */
    nft?: {
        assetId: string
        contract: Address
        tokenId: string
        standard: EvmNftStandard
        to: Address
        amount: Decimal
    }
    /**
     * Only on a contract call whose calldata is a standard token function. It
     * is a fact about the bytes, so it is set whatever the chain's
     * capabilities, and the review and the address-safety check both read it.
     */
    call?: EvmStandardCall
}

const KINDS: readonly string[] = [
    'transfer',
    'token-transfer',
    'nft-transfer',
    'contract-call',
]

const isAddressValue = (value: unknown): value is Address =>
    typeof value === 'string' && isAddress(value)

const isHexValue = (value: unknown): value is Hex =>
    typeof value === 'string' && isHex(value)

const isOptional = <T>(
    value: unknown,
    check: (value: unknown) => value is T,
): boolean => value === undefined || check(value)

const isToken = (value: unknown): boolean =>
    isRecord(value) &&
    isAddressValue(value.contract) &&
    isAddressValue(value.to) &&
    Decimal.isDecimal(value.amount)

const isNft = (value: unknown): boolean =>
    isRecord(value) &&
    typeof value.assetId === 'string' &&
    isAddressValue(value.contract) &&
    typeof value.tokenId === 'string' &&
    /^\d+$/.test(value.tokenId) &&
    (value.standard === 'erc721' || value.standard === 'erc1155') &&
    isAddressValue(value.to) &&
    Decimal.isDecimal(value.amount)

const isDigits = (value: unknown): boolean =>
    typeof value === 'string' && /^\d+$/.test(value)

const isNftItem = (value: unknown): boolean =>
    isRecord(value) &&
    isDigits(value.tokenId) &&
    Decimal.isDecimal(value.amount)

const isTransferParties = (value: Record<string, unknown>): boolean =>
    isAddressValue(value.from) && isAddressValue(value.to)

const isStandardCall = (value: unknown): boolean => {
    if (!isRecord(value) || !isAddressValue(value.contract)) return false
    switch (value.kind) {
        case 'transfer':
        case 'transfer-from': {
            return isTransferParties(value) && Decimal.isDecimal(value.value)
        }
        case 'erc721-safe-transfer': {
            return isTransferParties(value) && isDigits(value.tokenId)
        }
        case 'erc1155-transfer': {
            return (
                isTransferParties(value) &&
                Array.isArray(value.items) &&
                value.items.length > 0 &&
                value.items.every(isNftItem)
            )
        }
        case 'approve':
        case 'increase-allowance': {
            return (
                isAddressValue(value.spender) && Decimal.isDecimal(value.value)
            )
        }
        case 'set-approval-for-all': {
            return (
                isAddressValue(value.operator) &&
                typeof value.isApproved === 'boolean'
            )
        }
        default: {
            return false
        }
    }
}

const isFee = (value: unknown): boolean =>
    isRecord(value) &&
    Decimal.isDecimal(value.maxFeePerGas) &&
    Decimal.isDecimal(value.maxPriorityFeePerGas) &&
    Decimal.isDecimal(value.maxFee)

const isView = (value: unknown): value is EthereumTransactionView =>
    isRecord(value) &&
    typeof value.kind === 'string' &&
    KINDS.includes(value.kind) &&
    isAddressValue(value.from) &&
    isOptional(value.to, isAddressValue) &&
    Decimal.isDecimal(value.value) &&
    isHexValue(value.data) &&
    isOptional(value.selector, isHexValue) &&
    (value.isPreview === true ||
        ((value.isPreview === undefined || value.isPreview === false) &&
            typeof value.nonce === 'number' &&
            typeof value.gas === 'bigint' &&
            isFee(value.fee))) &&
    (value.token === undefined || isToken(value.token)) &&
    (value.nft === undefined || isNft(value.nft)) &&
    (value.call === undefined ||
        (value.kind === 'contract-call' && isStandardCall(value.call)))

export const toEthereumNative = (
    view: EthereumTransactionView,
): TransactionNative => ({ family: 'evm', transaction: view })

/** @throws unless `native` is an Ethereum transaction view. */
export const readEthereumNative = (
    native: TransactionNative,
): EthereumTransactionView => {
    if (native.family !== 'evm') {
        throw new Error(`Not an Ethereum transaction view: ${native.family}`)
    }
    if (!isView(native.transaction)) {
        throw new Error('The Ethereum transaction view is malformed')
    }
    return native.transaction
}
