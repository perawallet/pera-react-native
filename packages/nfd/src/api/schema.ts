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

const nfdNameApiSchema = z.object({
    name: z.string().min(1),
    source: z.string().min(1),
    image: z.string(),
})

export type NfdNameApiResponse = z.infer<typeof nfdNameApiSchema>

/** GET /v1/accounts/{address}/names/ — paginated response */
export const nfdNamesListResponseSchema = z.object({
    results: z.array(nfdNameApiSchema),
})

export type NfdNamesListApiResponse = z.infer<typeof nfdNamesListResponseSchema>

/** POST /v1/accounts/names/bulk-read/ */
export const nfdBulkReadResponseSchema = z.object({
    results: z.array(
        z.object({
            address: z.string(),
            name: nfdNameApiSchema.nullable(),
        }),
    ),
})

export type NfdBulkReadApiResponse = z.infer<typeof nfdBulkReadResponseSchema>

const nfdServiceSchema = z.object({
    name: z.string(),
    logo: z.string(),
})

/** GET /v1/name-services/search/ */
export const nfdSearchResponseSchema = z.object({
    count: z.number(),
    results: z.array(
        z.object({
            name: z.string(),
            address: z.string(),
            service: nfdServiceSchema,
        }),
    ),
})

export type NfdSearchApiResponse = z.infer<typeof nfdSearchResponseSchema>
