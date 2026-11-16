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
    contractActionTitleKeyOf,
    type EthereumTransactionView,
} from '@perawallet/wallet-core-chain-ethereum'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { transactionIconName } from '@components/TransactionIcon'
import {
    CONTRACT_CALL_TITLE_KEY,
    REVOKE_APPROVAL_TITLE_KEY,
} from '../utils/recordTitleKeys'
import type { EthereumContractActionPresentation } from './useEthereumContractAction'
import type { EthereumStandardCallPresentation } from './useEthereumStandardCall'

const isApproval = (
    standardCall: Nullable<EthereumStandardCallPresentation>,
): boolean =>
    standardCall?.kind === 'token-approval' ||
    standardCall?.kind === 'nft-approval' ||
    standardCall?.kind === 'collection-approval'

const isRevocation = (
    standardCall: EthereumStandardCallPresentation,
): boolean =>
    (standardCall.kind === 'token-approval' && !standardCall.spendApproval) ||
    (standardCall.kind === 'nft-approval' && standardCall.isRevocation) ||
    (standardCall.kind === 'collection-approval' && !standardCall.isApproved)

export const titleKeyOf = (
    view: EthereumTransactionView,
    standardCall: Nullable<EthereumStandardCallPresentation>,
    contractAction: Nullable<EthereumContractActionPresentation>,
): I18nKey => {
    if (standardCall && isApproval(standardCall)) {
        return isRevocation(standardCall)
            ? REVOKE_APPROVAL_TITLE_KEY
            : i18nKey('transactions.list_item.approval')
    }
    if (!standardCall && contractAction && view.action) {
        return contractActionTitleKeyOf(view.action)
    }
    return view.kind === 'contract-call' && !standardCall
        ? CONTRACT_CALL_TITLE_KEY
        : i18nKey('transactions.list_item.send')
}

const ACTION_ICON_NAMES: Record<
    EthereumContractActionPresentation['kind'],
    IconName
> = {
    swap: transactionIconName('swap'),
    wrap: transactionIconName('swap'),
    unwrap: transactionIconName('swap'),
    supply: 'fund',
    withdraw: 'inflow',
    borrow: 'inflow',
    repay: 'outflow',
    'add-liquidity': 'plus',
    'remove-liquidity': 'minus',
}

export const iconNameOf = (
    view: EthereumTransactionView,
    standardCall: Nullable<EthereumStandardCallPresentation>,
    contractAction: Nullable<EthereumContractActionPresentation>,
): IconName => {
    if (isApproval(standardCall)) return 'key'
    if (!standardCall && contractAction) {
        return ACTION_ICON_NAMES[contractAction.kind]
    }
    return view.kind === 'contract-call' && !standardCall
        ? 'code'
        : transactionIconName('send')
}

/** Who a standard call is with: a transfer's recipient, an approval's spender or operator. */
export const counterpartyOf = (
    standardCall: EthereumStandardCallPresentation,
): string => {
    switch (standardCall.kind) {
        case 'token-transfer':
        case 'nft-transfer': {
            return standardCall.to
        }
        case 'token-approval':
        case 'nft-approval': {
            return standardCall.spender
        }
        case 'collection-approval': {
            return standardCall.operator
        }
    }
}
