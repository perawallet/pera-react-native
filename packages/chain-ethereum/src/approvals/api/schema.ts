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
import type { Address } from 'viem'

const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/)

// A candidate is only a log the owner once emitted; whether the approval
// still stands is the chain's to say.
export const approvalCandidateSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('allowance'),
        token: evmAddress,
        spender: evmAddress,
    }),
    z.object({
        kind: z.literal('operator'),
        collection: evmAddress,
        operator: evmAddress,
        collection_name: z.string().nullish(),
    }),
])

export type ApprovalCandidateResponse = z.input<typeof approvalCandidateSchema>

// Rows are checked one by one, so one unreadable row drops itself rather
// than the whole list.
export const approvalCandidatesPageSchema = z.object({
    results: z.array(z.unknown()),
    next: z.string().nullable(),
})

export type EvmApprovalCandidate =
    | { kind: 'allowance'; token: Address; spender: Address }
    | {
          kind: 'operator'
          collection: Address
          operator: Address
          collectionName?: string
      }
