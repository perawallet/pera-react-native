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

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
const amount = z.string().regex(/^\d+$/)

const nftTransferSchema = z.object({
    standard: z.enum(['erc721', 'erc1155']),
    contract: address,
    token_id: amount,
    /** Base units: an NFT has no decimals. */
    quantity: amount,
    from: address,
    to: address,
    collection_name: z.string().nullable(),
    collection_symbol: z.string().nullable(),
})

// Legs are checked one by one, so an unreadable leg drops itself, not the row.
const readableLegs = <Leg extends z.ZodType>(leg: Leg) =>
    z.array(z.unknown()).transform(legs =>
        legs.flatMap(candidate => {
            const parsed = leg.safeParse(candidate)
            return parsed.success ? [parsed.data] : []
        }),
    )

const nftTransfersSchema = readableLegs(nftTransferSchema)

const tokenTransferSchema = z.object({
    contract: address,
    from: address,
    to: address,
    value: amount,
    token_symbol: z.string().nullable().catch(null),
    // ERC-20 `decimals` is a uint8.
    token_decimals: z.number().int().min(0).max(255).nullable().catch(null),
})

const internalTransferSchema = z.object({
    from: address,
    /** Null when the call created a contract. */
    to: address.nullable(),
    /** Wei. */
    value: amount,
    status: z.enum(['success', 'failed']),
})

export type EvmNftTransfer = z.output<typeof nftTransferSchema>
export type EvmTokenTransfer = z.output<typeof tokenTransferSchema>

/** Only the fields the adapter reads; the full wire shape is `EvmHistoryItemResponse`. */
export const evmHistoryItemSchema = z.object({
    kind: z.enum(['transaction', 'withdrawal']),
    // Lowercase, as viem's keccak256 gives the submission ledger, so a
    // pending send and its mined row share one id.
    hash: z.string().toLowerCase().nullable(),
    block_time: z.iso.datetime({ offset: true }),
    from: address.nullable(),
    to: address.nullable(),
    value: amount.nullable(),
    fee: amount.nullable(),
    status: z.enum(['success', 'failed']),
    method: z.string().nullable(),
    token_transfers: z.array(tokenTransferSchema),
    internal_transfers: readableLegs(internalTransferSchema).catch([]),
    nft_transfers: nftTransfersSchema,
    withdrawals: z.array(z.object({ index: z.number().int().min(0) })),
    balance_impacts: z.array(
        z.object({
            /** CAIP-19. */
            asset_id: z.string(),
            /** Signed base units. */
            amount: z.string().regex(/^-?\d+$/),
        }),
    ),
})

export type EvmHistoryItem = z.output<typeof evmHistoryItemSchema>

// Rows are checked one by one, so a row this client predates (a new `kind`)
// drops that row rather than the whole page.
export const evmHistoryPageSchema = z.object({
    next: z.string().nullable(),
    results: z.array(z.unknown()),
})

/** A row as the backend sends it: amounts are base-unit decimal strings and addresses are lowercase. */
export type EvmHistoryItemResponse = {
    kind: 'transaction' | 'withdrawal'
    /** Null on a withdrawal row. */
    hash: string | null
    block_number: number
    /** ISO 8601. */
    block_time: string
    /** Null, with `to`, `value` and `method`, when the row is known only from a transfer stream. */
    from: string | null
    to: string | null
    value: string | null
    /** Wei: the transaction's total gas cost, whoever paid it. */
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    fee: string | null
    status: 'success' | 'failed'
    method: string | null
    token_transfers: {
        asset_id: string
        contract: string
        from: string
        to: string
        value: string
        token_name: string | null
        token_symbol: string | null
        token_decimals: number | null
    }[]
    internal_transfers: {
        from: string
        to: string | null
        value: string
        status: 'success' | 'failed'
    }[]
    nft_transfers: {
        standard: 'erc721' | 'erc1155'
        contract: string
        token_id: string
        quantity: string
        from: string
        to: string
        collection_name: string | null
        collection_symbol: string | null
    }[]
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    withdrawals: { index: number; validator_index: number; amount: string }[]
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    balance_impacts: { asset_id: string; amount: string }[]
}
