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

import type { Decimal } from 'decimal.js'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import {
    readEvmRecordGas,
    type EthereumTransactionView,
} from '@perawallet/wallet-core-chain-ethereum'
import type { Optional } from '@perawallet/wallet-core-shared'

/** Gas units for `gasLimit` and `gasUsed`; wei per gas for the prices. Each part only when known. */
export type EthereumTransactionPricing = {
    nonce?: number
    gasLimit?: bigint
    gasUsed?: bigint
    maxFeePerGas?: Decimal
    maxPriorityFeePerGas?: Decimal
    /** The single price an older transaction set, or the effective price a mined one paid. */
    gasPrice?: Decimal
}

/** What the signature commits to, or what the node reports for a mined transaction. */
export const viewPricingOf = (
    view: EthereumTransactionView,
): Optional<EthereumTransactionPricing> => {
    if ('fee' in view) {
        return {
            nonce: view.nonce,
            gasLimit: view.gas,
            maxFeePerGas: view.fee.maxFeePerGas,
            maxPriorityFeePerGas: view.fee.maxPriorityFeePerGas,
        }
    }
    if (!('isMined' in view) || !view.onChain) return undefined
    const { nonce, gas, ...prices } = view.onChain
    return { nonce, gasLimit: gas, ...prices }
}

/** What the history backend gave for a record's gas, when it gave any. */
export const recordPricingOf = (
    record: TransactionRecord,
): Optional<EthereumTransactionPricing> => readEvmRecordGas(record)

/** Each part from the first source that has it; undefined when none has any. */
export const mergePricing = (
    ...sources: Optional<EthereumTransactionPricing>[]
): Optional<EthereumTransactionPricing> => {
    const merged: EthereumTransactionPricing = {}
    for (const source of sources) {
        if (!source) continue
        for (const [key, value] of Object.entries(source)) {
            const field = key as keyof EthereumTransactionPricing
            if (value !== undefined && merged[field] === undefined) {
                Object.assign(merged, { [field]: value })
            }
        }
    }
    return Object.keys(merged).length > 0 ? merged : undefined
}
