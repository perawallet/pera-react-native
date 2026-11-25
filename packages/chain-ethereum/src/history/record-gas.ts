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

import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

export type EvmRecordGas = NonNullable<
    Extract<TransactionRecord['chainData'], { family: 'evm' }>['gas']
>

/** What the history backend said of an EVM record's gas; undefined on another chain's record or when it said nothing. */
export const readEvmRecordGas = (
    record: TransactionRecord,
): Optional<EvmRecordGas> =>
    record.chainData.family === 'evm' ? record.chainData.gas : undefined
