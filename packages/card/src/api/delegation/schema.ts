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

// GET /v1/delegation/token — single-use pair, ~10 minute validity.
export const delegationTokenResponseSchema = z.object({
    token: z.string(),
    nonce: z.string(),
})

// Monetary fields arrive as decimal STRINGS and are wrapped in Decimal by the
// transformer — never parsed as JS numbers (which would lose precision).
const externalWalletApiSchema = z.object({
    address: z.string(),
    currency: z.string(),
    balance: z.string().optional().nullable(),
    allowance: z.string().optional().nullable(),
    network: z.string().optional().nullable(),
})
export type ExternalWalletApiResponse = z.infer<typeof externalWalletApiSchema>

// GET /v1/wallet/external returns a bare array (like /v1/wallet/internal).
export const externalWalletsResponseSchema = z.array(externalWalletApiSchema)

// ─── SWAP POINT: Baanx Algorand delegation contract (not shipped) ───────────
// Baanx documents delegation for EVM/Solana only; the Algorand variant below
// is ASSUMED to mirror it, with the signed delegated LogicSig standing in for
// the on-chain approval proof. When the real contract lands, update only this
// block, the matching endpoints, and the dev mock.

// ASSUMED: GET /v1/delegation/chain/config?network=algorand serves the
// compiled delegation program the user signs.
export const delegationProgramResponseSchema = z.object({
    /** Base64 compiled delegation program. */
    program: z.string(),
    version: z.string().optional(),
})

// ASSUMED: POST /v1/delegation/algorand/post-approval
export const algorandPostApprovalResponseSchema = z.object({
    success: z.boolean(),
})
// ─── END SWAP POINT ──────────────────────────────────────────────────────────
