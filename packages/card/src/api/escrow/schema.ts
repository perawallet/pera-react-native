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

// ─── SWAP POINT: AppliedBlockchain (AB) escrow card service ─────────────────
// AB's demo records the approval via POST /api/approvals and ignores the
// response. In production the server performs the on-chain `cardCreate`, so we
// ASSUME the response returns the created escrow card address — the delegated
// LSig step needs it. Confirm the real shape with AB and update this block, the
// matching endpoints, and the dev mock together.

// POST /api/approvals → the created escrow card's account address.
export const escrowCardCreationResponseSchema = z.object({
    cardAddress: z.string(),
})

// POST /api/internal/delegator-lsig → echoes the delegator address (from AB's
// demo `PostDelegatorLsigResponse`).
export const delegatorLsigResponseSchema = z.object({
    delegatorAddress: z.string(),
})
// ─── END SWAP POINT ──────────────────────────────────────────────────────────
