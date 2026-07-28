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
    type PeraAsset,
    type PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'
import { z } from 'zod'
import { uint64IdSchema, type Nullable } from '@perawallet/wallet-core-shared'

export const arc59WarningMessageSchema = z.object({
    title: z.string(),
    detail: z.string(),
    link: z.string(),
    link_text: z.string(),
})

// These arrive as JSON integers in base units (microAlgos) or as a count, and
// flow straight into BigInt() and a payment amount. Reject floats (BigInt() of a
// non-integer throws), negatives, and precision-losing magnitudes (> 2^53) at the
// boundary so a malformed or hostile summary can't crash signing or fund a bogus
// payment.
const safeBaseUnitInteger = z
    .number()
    .int()
    .nonnegative()
    .lte(Number.MAX_SAFE_INTEGER)

// The sender's ARC-59 payment is `algo_fund_amount + minimum_balance_requirement`
// (see getArc59SignedFundingAmount) and is signed headlessly. Both are pure
// MBR/funding values — inbox creation + asset opt-in MBR is O(0.2 ALGO) — so an
// absolute ceiling far above any legitimate value hard-rejects a hostile
// summary that would otherwise drain the account. MAX_SAFE_INTEGER (~9e9 ALGO)
// is not a bound (PERA-4710).
export const MAX_ARC59_FUNDING_MICRO_ALGO = 10_000_000 // 10 ALGO
export const arc59SendSummaryResponseSchema = z
    .object({
        is_arc59_opted_in: z.boolean(),
        minimum_balance_requirement: safeBaseUnitInteger,
        inner_tx_count: safeBaseUnitInteger,
        total_protocol_and_mbr_fee: safeBaseUnitInteger,
        inbox_address: z.string().nullable(),
        algo_fund_amount: safeBaseUnitInteger,
        warning_message: arc59WarningMessageSchema.nullable(),
    })
    // The ceiling applies to the SUM, because the sum is what gets signed.
    // Bounding each field on its own would still admit 2 × the limit.
    .refine(
        summary =>
            summary.algo_fund_amount + summary.minimum_balance_requirement <=
            MAX_ARC59_FUNDING_MICRO_ALGO,
        {
            message: `ARC-59 funding total exceeds ${MAX_ARC59_FUNDING_MICRO_ALGO} microAlgo`,
        },
    )

export type Arc59SendSummaryResponse = z.infer<
    typeof arc59SendSummaryResponseSchema
>
export type Arc59WarningMessage = z.infer<typeof arc59WarningMessageSchema>

const arc59AssetCreatorSchema = z.object({
    address: z.string(),
})

const arc59AssetCollectibleSchema = z.object({
    title: z.string(),
    primary_image: z.string().nullable(),
})

const arc59AssetSchema = z.object({
    // uint64 asset id — normalized to a decimal string (see uint64IdSchema).
    asset_id: uint64IdSchema,
    name: z.string(),
    logo: z.string().nullable(),
    unit_name: z.string(),
    fraction_decimals: z.number(),
    usd_value: z.string().nullable(),
    verification_tier: z.string(),
    is_verified: z.boolean(),
    is_deleted: z.boolean(),
    collectible: arc59AssetCollectibleSchema.optional().nullable(),
    creator: arc59AssetCreatorSchema,
    type: z.enum(['standard_asset', 'collectible']),
})

const arc59SenderSchema = z.object({
    sender: z.object({
        address: z.string(),
        name: z.string().nullable(),
    }),
    amount: z.coerce.string(),
})

const arc59SendersSchema = z.object({
    count: z.number(),
    results: z.array(arc59SenderSchema),
})

export const arc59AssetRequestSchema = z.object({
    total_amount: z.coerce.string(),
    asset: arc59AssetSchema,
    algo_gain_on_claim: z.coerce.string(),
    algo_gain_on_reject: z.coerce.string(),
    senders: arc59SendersSchema,
    insufficient_algo_for_claiming: z.boolean(),
    insufficient_algo_for_rejecting: z.boolean(),
    should_use_funds_before_claiming: z.boolean(),
    should_use_funds_before_rejecting: z.boolean(),
})

export const arc59AssetRequestsResponseSchema = z.object({
    results: z.array(arc59AssetRequestSchema),
    inbox_address: z.string().nullable().optional(),
})

export type Arc59AssetRequestResponse = z.infer<typeof arc59AssetRequestSchema>
export type Arc59AssetRequestsResponse = z.infer<
    typeof arc59AssetRequestsResponseSchema
>

export type Arc59AssetRequest = {
    id?: string
    /** The receiver's ARC-59 inbox account address, or null if none exists yet. */
    inboxAddress: Nullable<string>
    /** Total amount across all senders, in base units */
    totalAmount: Decimal
    asset: PeraAsset
    usdValue: Nullable<Decimal>
    /** ALGO gain on claim, in microAlgos (base units) */
    microAlgoGainOnClaim: Decimal
    /** ALGO gain on reject, in microAlgos (base units) */
    microAlgoGainOnReject: Decimal
    senders: {
        count: number
        results: Array<{
            sender: { address: string; name: Nullable<string> }
            /** Sender's amount, in base units */
            amount: Decimal
        }>
    }
    insufficientAlgoForClaiming: boolean
    insufficientAlgoForRejecting: boolean
    shouldUseFundsBeforeClaiming: boolean
    shouldUseFundsBeforeRejecting: boolean
}

export const mapArc59AssetRequest = (
    raw: Arc59AssetRequestResponse,
    inboxAddress: Nullable<string> = null,
): Arc59AssetRequest => ({
    id: raw.asset.asset_id,
    inboxAddress,
    totalAmount: new Decimal(raw.total_amount),
    asset: {
        assetId: raw.asset.asset_id,
        name: raw.asset.name,
        unitName: raw.asset.unit_name,
        decimals: raw.asset.fraction_decimals,
        peraMetadata: {
            verificationTier: raw.asset
                .verification_tier as PeraAssetVerificationTier,
            isVerified: raw.asset.is_verified,
            isDeleted: raw.asset.is_deleted,
            logo: raw.asset.logo,
            collectible: raw.asset.collectible
                ? {
                      title: raw.asset.collectible.title,
                      primaryImage:
                          raw.asset.collectible.primary_image ?? undefined,
                  }
                : undefined,
        },
        creator: { address: raw.asset.creator.address },
        totalSupply: new Decimal(0),
    },
    usdValue: raw.asset.usd_value ? new Decimal(raw.asset.usd_value) : null,
    microAlgoGainOnClaim: new Decimal(raw.algo_gain_on_claim),
    microAlgoGainOnReject: new Decimal(raw.algo_gain_on_reject),
    senders: {
        count: raw.senders.count,
        results: raw.senders.results.map(s => ({
            sender: { address: s.sender.address, name: s.sender.name },
            amount: new Decimal(s.amount),
        })),
    },
    insufficientAlgoForClaiming: raw.insufficient_algo_for_claiming,
    insufficientAlgoForRejecting: raw.insufficient_algo_for_rejecting,
    shouldUseFundsBeforeClaiming: raw.should_use_funds_before_claiming,
    shouldUseFundsBeforeRejecting: raw.should_use_funds_before_rejecting,
})
