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

import { z } from 'zod'

/**
 * ARC-0001 WalletTransaction (request side): `txn` is the base64 canonical
 * msgpack of an UNSIGNED transaction. The backend rejects pre-signed entries —
 * it re-groups the payload (new group id), so nothing may be signed yet.
 */
export const feeDelegationWalletTransactionSchema = z.object({
    txn: z.string(),
    signers: z.array(z.string()).optional(),
})
export type FeeDelegationWalletTransaction = z.infer<
    typeof feeDelegationWalletTransactionSchema
>

export const feeDelegationRequestSchema = z.object({
    txnGroup: z.array(feeDelegationWalletTransactionSchema),
    /** The wallet account the sponsorship is for. */
    account: z.string(),
    /**
     * When true the sponsor also tops the account up to its minimum balance,
     * including the increase from NEW asset opt-ins in `txnGroup`. Box and
     * app-storage MBR are out of the backend's scope (hence the field name).
     */
    includeAssetOptInMbr: z.boolean(),
    /**
     * Asset ids of the opt-ins contained in `txnGroup`, as decimal strings —
     * uint64 asset ids can exceed Number.MAX_SAFE_INTEGER.
     */
    optInAssetIds: z.array(z.string()),
})
export type FeeDelegationRequest = z.infer<typeof feeDelegationRequestSchema>

/**
 * Response: the re-grouped ARC-0001 transactions. The sponsor slot carries
 * `stxn` (already signed); the wallet's own slots have no `stxn` and must be
 * signed against the NEW group id.
 */
export const feeDelegationResponseSchema = z.object({
    txnGroup: z.array(
        z.object({
            txn: z.string(),
            signers: z.array(z.string()),
            stxn: z.string().optional(),
        }),
    ),
})
export type FeeDelegationApiResponse = z.infer<
    typeof feeDelegationResponseSchema
>
