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

import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { ReviewedAddress } from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { EvmStandardCall } from './standard-call-types'
import {
    readEthereumNative,
    type EthereumTransactionView,
} from './transaction-view'

const callAddresses = (call: EvmStandardCall): ReviewedAddress[] => {
    const target: ReviewedAddress = { address: call.contract, role: 'target' }
    switch (call.kind) {
        case 'transfer':
        case 'transfer-from':
        case 'erc721-safe-transfer':
        case 'erc1155-transfer': {
            return [{ address: call.to, role: 'token-recipient' }, target]
        }
        case 'approve':
        case 'increase-allowance': {
            return [{ address: call.spender, role: 'spender' }, target]
        }
        case 'set-approval-for-all': {
            return [{ address: call.operator, role: 'operator' }, target]
        }
    }
}

const viewOf = (
    transaction: TransactionNative,
): Optional<EthereumTransactionView> => {
    try {
        return readEthereumNative(transaction)
    } catch {
        return undefined
    }
}

// `view.call` is read whatever `contractDecoding` is set to: a spender is just
// as dangerous when the review doesn't name it.
export const ethereumReviewedAddresses = (
    transaction: TransactionNative,
): ReviewedAddress[] => {
    const view = viewOf(transaction)
    if (!view) return []
    if (view.call) return callAddresses(view.call)

    const tokenRecipient = view.token?.to ?? view.nft?.to
    const contract = view.token?.contract ?? view.nft?.contract
    if (tokenRecipient && contract) {
        return [
            { address: tokenRecipient, role: 'token-recipient' },
            { address: contract, role: 'target' },
        ]
    }
    if (!view.to) return []
    return [
        {
            address: view.to,
            role: view.data === '0x' ? 'recipient' : 'target',
        },
    ]
}
