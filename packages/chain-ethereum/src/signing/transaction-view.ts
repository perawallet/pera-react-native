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
import { isRecord } from './adapter'

/** An Ethereum transaction as review and detail screens read it. */
export type EthereumTransactionView = {
    kind: 'transfer' | 'token-transfer' | 'contract-call'
    from: Address
    /** Absent for a contract creation. */
    to?: Address
    /** Wei. */
    value: Decimal
    /** Calldata as sent; `'0x'` when empty. */
    data: Hex
    /** First four bytes of `data`; absent when `data` is shorter. */
    selector?: Hex
    nonce: number
    gas: bigint
    /** Wei. `maxFee` is `gas * maxFeePerGas`, the most the signature authorises. */
    fee: {
        maxFeePerGas: Decimal
        maxPriorityFeePerGas: Decimal
        maxFee: Decimal
    }
    /** Only on a verified token transfer; `amount` in the token's base units. */
    token?: { contract: Address; to: Address; amount: Decimal }
}

const KINDS: readonly string[] = ['transfer', 'token-transfer', 'contract-call']

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
    typeof value.nonce === 'number' &&
    typeof value.gas === 'bigint' &&
    isFee(value.fee) &&
    (value.token === undefined || isToken(value.token))

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
