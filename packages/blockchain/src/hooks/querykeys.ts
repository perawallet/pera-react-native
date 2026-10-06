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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { QueryKey } from '@tanstack/react-query'

const MODULE_PREFIX = 'blockchain'

export const isBlockchainQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

export const getSuggestedParametersQueryKey = (scope: ChainScope) => [
    MODULE_PREFIX,
    'suggested-parameters',
    { scope },
]

export const getTransactionDetailQueryKey = (
    transactionId: string,
    scope: ChainScope,
) => [MODULE_PREFIX, 'transaction-detail', { transactionId, scope }]

export const getAccountSigTypeQueryKey = (
    address: string,
    scope: ChainScope,
) => [MODULE_PREFIX, 'account-sig-type', { address, scope }]

export const getGroupTransactionsQueryKey = (
    groupId: string,
    scope: ChainScope,
) => [MODULE_PREFIX, 'group-transactions', { groupId, scope }]
