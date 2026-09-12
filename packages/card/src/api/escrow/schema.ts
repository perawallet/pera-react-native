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

// POST /api/approvals echoes the stored approval record. `address` is the
// escrow card (what we sent); the other fields (transaction.blockNumber,
// status, userId) are AB bookkeeping the wallet does not act on.
export const escrowCardApprovalResponseSchema = z.object({
    address: z.string(),
})

// POST /api/internal/delegator-lsig replies 201; AB has not published the
// body, so nothing in it is relied on.
export const delegatorLsigResponseSchema = z.object({
    delegatorAddress: z.string().optional(),
})
