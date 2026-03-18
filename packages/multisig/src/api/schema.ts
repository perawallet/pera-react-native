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

export const createMultisigAccountRequestSchema = z.object({
    version: z.number(),
    threshold: z.number(),
    participant_addresses: z.array(z.string()),
    device_id: z.string(),
})

export const createMultisigAccountResponseSchema = multiSigAccountResponseSchema

export const proposeSignRequestSchema = z.object({
    joint_account_address: z.string(),
    proposer_address: z.string(),
    type: z.string(),
    raw_transaction_lists: z.array(z.array(z.string())),
    responses: z.array(
        z.object({
            address: z.string(),
            response: z.enum(['signed', 'declined']),
            signatures: z.array(z.array(z.string().nullable())),
        }),
    ),
})

export const proposeSignRequestResponseSchema = signRequestResponseSchema

export const addSignatureRequestSchema = z.object({
    address: z.string(),
    response: z.enum(['signed', 'declined']),
    signatures: z.array(z.array(z.string().nullable())).optional(),
    device_id: z.string().optional(),
})

export const declineRequestSchema = z.object({
    address: z.string(),
    response: z.literal('declined'),
    device_id: z.string(),
})

export const signRequestDetailResponseSchema = signRequestResponseSchema

export const deleteImportInboxResponseSchema = z.void()

export type MultiSigAccountResponse = z.infer<
    typeof multiSigAccountResponseSchema
>
export type SignResponse = z.infer<typeof signResponseSchema>
export type TransactionListResponse = z.infer<
    typeof transactionListResponseSchema
>
export type SignRequestResponse = z.infer<typeof signRequestResponseSchema>
export type CreateMultisigAccountRequest = z.infer<
    typeof createMultisigAccountRequestSchema
>
export type CreateMultisigAccountResponse = z.infer<
    typeof createMultisigAccountResponseSchema
>
export type ProposeSignRequest = z.infer<typeof proposeSignRequestSchema>
export type ProposeSignRequestResponse = z.infer<
    typeof proposeSignRequestResponseSchema
>
export type AddSignatureRequest = z.infer<typeof addSignatureRequestSchema>
export type DeclineRequest = z.infer<typeof declineRequestSchema>
export type SignRequestDetailResponse = z.infer<
    typeof signRequestDetailResponseSchema
>
