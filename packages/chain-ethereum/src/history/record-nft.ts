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

import type {
    ChainTransactionData,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

export type EvmRecordNft = NonNullable<
    Extract<ChainTransactionData, { family: 'evm' }>['nft']
>

/** The single NFT an EVM history record moves; unset on any other record. */
export const readEvmRecordNft = (
    record: TransactionRecord,
): Optional<EvmRecordNft> =>
    record.chainData.family === 'evm' ? record.chainData.nft : undefined
