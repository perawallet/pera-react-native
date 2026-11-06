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
const decimalString = z.string().regex(/^\d+$/)

const assetChangeSchema = z.object({
    asset_id: z.string(),
    standard: z.enum(['native', 'erc20', 'erc721', 'erc1155']),
    token_id: decimalString.nullable(),
    amount: z.string().regex(/^-?\d+$/),
})

const approvalChangeSchema = z.object({
    contract: address,
    spender: address,
    token_id: decimalString.nullable(),
    collection_wide: z.boolean(),
    allowance: z.union([z.literal('unlimited'), decimalString]),
})

// Every key is always present. `unavailable_reason` stays a free string: the
// app never reads it, and a reason the backend adds later must not fail the answer.
export const evmSimulationResponseSchema = z.object({
    status: z.enum(['success', 'reverted', 'unavailable']),
    block_number: z.number().int().nullable(),
    asset_changes: z.array(assetChangeSchema),
    approval_changes: z.array(approvalChangeSchema),
    revert_reason: z.string().nullable(),
    unavailable_reason: z.string().nullable(),
})

export type EvmSimulationResponse = z.infer<typeof evmSimulationResponseSchema>
