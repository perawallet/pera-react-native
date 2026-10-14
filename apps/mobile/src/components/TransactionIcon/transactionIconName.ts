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

import type { TransactionIconKind } from '@perawallet/wallet-core-chain-contract'
import type { IconName } from '@components/core'

const ICON_NAMES: Record<TransactionIconKind, IconName> = {
    send: 'transactions/send',
    receive: 'transactions/receive',
    // The icon set has no self-transfer glyph; a self-send still left the account.
    self: 'transactions/send',
    swap: 'transactions/swap',
    'contract-call': 'transactions/application-call',
    approval: 'transactions/application-call',
    'opt-in': 'transactions/opt-in',
    'opt-out': 'transactions/opt-out',
    'asset-config': 'transactions/asset-config',
    'asset-freeze': 'transactions/asset-freeze',
    consensus: 'transactions/key-registration',
    unknown: 'transactions/generic',
}

export const transactionIconName = (kind: TransactionIconKind): IconName =>
    ICON_NAMES[kind] ?? 'transactions/generic'
