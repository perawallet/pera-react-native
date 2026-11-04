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

// Registry and proxy standard are left as strings, since the app never reads
// them and a new one must not fail the lookup. ABI items are left raw: the
// decoder reads only well-formed function items, so one odd entry never costs
// the whole answer.
const proxySchema = z
    .object({ standard: z.string(), implementation: address })
    .nullable()

export const evmContractAbiResponseSchema = z.union([
    z.object({
        status: z.literal('verified'),
        abi: z.array(z.unknown()),
        registry: z.string(),
        proxy: proxySchema,
    }),
    // `unresolved_proxy`: a proxy whose implementation the backend can't read,
    // so there is no ABI to name the call with.
    z.object({
        status: z.enum(['not_verified', 'unresolved_proxy']),
        abi: z.null(),
        registry: z.null(),
        proxy: proxySchema,
    }),
])

export type EvmContractAbiResponse = z.infer<
    typeof evmContractAbiResponseSchema
>
