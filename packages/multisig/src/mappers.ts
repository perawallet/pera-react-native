/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    MultiSigAccountResponse,
    SignRequestResponse,
    TransactionListResponse,
} from './api/schema'
import type {
    JointAccountSignRequest,
    MultiSigAccount,
    TransactionList,
} from './models'

export const mapMultiSigAccount = (
    response: MultiSigAccountResponse,
): MultiSigAccount => ({
    customId: response.custom_id,
    createdAt: new Date(response.creation_datetime),
    address: response.address,
    version: response.version,
    threshold: response.threshold,
    participantAddresses: response.participant_addresses,
})

export const mapTransactionList = (
    response: TransactionListResponse,
): TransactionList => ({
    id: response.id,
    rawTransactions: response.raw_transactions,
    firstValidBlock: response.first_valid_block,
    lastValidBlock: response.last_valid_block,
    expectedExpireDatetime: new Date(response.expected_expire_datetime),
    responses: response.responses,
})

export const mapSignRequest = (
    response: SignRequestResponse,
): JointAccountSignRequest => ({
    id: response.id,
    status: response.status,
    type: response.type,
    createdAt: new Date(response.creation_datetime),
    expectedExpireDatetime: new Date(response.expected_expire_datetime),
    failReasonDisplay: response.fail_reason_display,
    jointAccount: mapMultiSigAccount(response.joint_account),
    transactionLists: response.transaction_lists.map(mapTransactionList),
})
