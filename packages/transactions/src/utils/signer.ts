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

import { isSameAddress } from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    TransactionRecord,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * Who signed the record, as far as the history says. The wallet's own attempts
 * that haven't landed name no initiator, while a confirmed record with none
 * came from a transfer log or an ERC-20 view, which don't say who signed.
 */
export const recordSignerOf = (
    record: TransactionRecord,
    accountAddress: string,
): Optional<string> => {
    if (record.initiator !== undefined) return record.initiator
    return accountAddress !== '' && record.status !== 'confirmed'
        ? accountAddress
        : undefined
}

export type IsSentByOtherSignerInput = {
    summary: TransactionSummary
    signer: Optional<string>
    isSignedElsewhere?: boolean
    accountAddress: string
    chainId: ChainId
}

/** An unnamed signer counts as the account's: only a named other address, or a known third-party signer, says otherwise. */
export const isSentByOtherSigner = ({
    summary,
    signer,
    isSignedElsewhere,
    accountAddress,
    chainId,
}: IsSentByOtherSignerInput): boolean => {
    if (accountAddress === '' || summary.direction !== 'out') return false
    if (isSignedElsewhere === true) return true
    return signer !== undefined && !isSameAddress(chainId, signer, accountAddress)
}
