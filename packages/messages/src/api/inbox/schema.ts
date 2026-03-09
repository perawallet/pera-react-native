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

import { z } from 'zod'
import {
    multiSigAccountResponseSchema,
    signRequestResponseSchema,
} from '@perawallet/wallet-core-multisig'

export {
    multiSigAccountResponseSchema,
    signResponseSchema,
    transactionListResponseSchema,
    signRequestResponseSchema,
} from '@perawallet/wallet-core-multisig'

export type {
    MultiSigAccountResponse,
    SignResponse,
    TransactionListResponse,
    SignRequestResponse,
} from '@perawallet/wallet-core-multisig'

export const asaInboxResponseSchema = z.object({
    address: z.string(),
    inbox_address: z.string().nullable(),
    request_count: z.number(),
})

export const inboxResponseSchema = z.object({
    joint_account_import_requests: z.array(multiSigAccountResponseSchema),
    joint_account_sign_requests: z.array(signRequestResponseSchema),
    asa_inboxes: z.array(asaInboxResponseSchema),
})

export type ASAInboxResponse = z.infer<typeof asaInboxResponseSchema>
export type InboxResponse = z.infer<typeof inboxResponseSchema>
