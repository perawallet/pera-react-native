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

import {
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { areEvmAddressesEqual } from '../accounts/address-codec'

const SEND_TITLE_KEY = i18nKey('transactions.list_item.send')

// The builder and the reviewer both describe a send through this, so a
// transfer the wallet builds reads the same once review rebuilds it from the bytes.
export const sendSummary = (
    kind: 'transfer' | 'token-transfer',
    from: string,
    to: string,
    amount: NonNullable<TransactionSummary['amount']>,
): TransactionSummary => {
    const isSelf = areEvmAddressesEqual(from, to)
    return {
        kind,
        title: { key: SEND_TITLE_KEY },
        direction: isSelf ? 'self' : 'out',
        icon: isSelf ? 'self' : 'send',
        counterparty: to,
        amount,
    }
}
