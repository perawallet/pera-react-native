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
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import { recordSignerOf } from '@perawallet/wallet-core-transactions'
import type { EthereumTransactionPresentation } from '../hooks/useEthereumTransactionPresentation'

// A read call names its contract in its own technical section; only a call the
// account made has a contract as its counterparty, not an address that paid it.
export const callTargetOf = (
    record: TransactionRecord,
    ownAddress: string,
    presentation: Maybe<EthereumTransactionPresentation>,
): Optional<string> => {
    const { kind, counterparty } = record.summary
    if (presentation || kind !== 'contract-call' || !counterparty) {
        return undefined
    }
    const signer = recordSignerOf(record, ownAddress)
    return signer && isSameAddress(record.scope.chainId, signer, ownAddress)
        ? counterparty
        : undefined
}
