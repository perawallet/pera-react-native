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

const addressNameApiSchema = z.object({
    name: z.string().min(1),
    source: z.string().min(1),
    // ENS names carry no avatar.
    image: z.string().nullable(),
})

export type AddressNameApiResponse = z.infer<typeof addressNameApiSchema>

/** POST /api/v4/accounts/names/ */
export const addressNamesResponseSchema = z.object({
    results: z.array(
        z.object({
            address: z.string(),
            name: addressNameApiSchema.nullable(),
        }),
    ),
})

export type AddressNamesApiResponse = z.infer<typeof addressNamesResponseSchema>

const nameServiceSchema = z.object({
    name: z.string(),
    logo: z.string(),
})

/** GET /api/v4/name-services/search/ */
export const nameSearchResponseSchema = z.object({
    count: z.number(),
    results: z.array(
        z.object({
            name: z.string(),
            address: z.string(),
            /** CAIP-2 id of the chain the name resolves on. */
            chain: z.string(),
            service: nameServiceSchema,
        }),
    ),
})

export type NameSearchApiResponse = z.infer<typeof nameSearchResponseSchema>
