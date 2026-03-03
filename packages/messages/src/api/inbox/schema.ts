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

export const multiSigAccountResponseSchema = z.object({
    custom_id: z.string(),
    creation_datetime: z.string(),
    address: z.string(),
    version: z.number(),
    threshold: z.number(),
    participant_addresses: z.array(z.string()),
})

export const signResponseSchema = z.object({
    address: z.string(),
    response: z.enum(['signed', 'declined']),
})

export const transactionListResponseSchema = z.object({
    id: z.coerce.string(),
    raw_transactions: z.array(z.string()),
    first_valid_block: z.number(),
    last_valid_block: z.number(),
    expected_expire_datetime: z.string(),
    responses: z.array(signResponseSchema),
})

export const signRequestResponseSchema = z.object({
    id: z.coerce.string(),
    status: z.enum([
        'pending',
        'ready',
        'submitting',
        'confirmed',
        'failed',
        'expired',
        'declined',
    ]),
    type: z.string(),
    creation_datetime: z.string(),
    expected_expire_datetime: z.string(),
    fail_reason_display: z.string().nullable(),
    joint_account: multiSigAccountResponseSchema,
    transaction_lists: z.array(transactionListResponseSchema),
})

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

export type MultiSigAccountResponse = z.infer<
    typeof multiSigAccountResponseSchema
>
export type SignResponse = z.infer<typeof signResponseSchema>
export type TransactionListResponse = z.infer<
    typeof transactionListResponseSchema
>
export type SignRequestResponse = z.infer<typeof signRequestResponseSchema>
export type ASAInboxResponse = z.infer<typeof asaInboxResponseSchema>
export type InboxResponse = z.infer<typeof inboxResponseSchema>
