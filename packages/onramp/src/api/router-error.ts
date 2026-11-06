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
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'

import { unwrapNetworkError } from '../errors/unwrap'
import { baseUnitsSchema } from './router-asset'

// A malformed limit must not hide the error it came with, so it reads as absent.
const limitSchema = baseUnitsSchema.nullish().catch(undefined)

/** The `{ error, code }` body the swap router and the sponsor route answer with. */
const routerErrorBodySchema = z.object({
    error: z.string(),
    code: z.string().nullish(),
    source_amount_minimum: limitSchema,
    source_amount_maximum: limitSchema,
})

export type RouterErrorBody = z.infer<typeof routerErrorBodySchema>

/** The router's error body, from the error itself or the parsed body the ky client attaches. */
export const resolveRouterErrorBody = (
    error: unknown,
): Nullable<RouterErrorBody> => {
    const raw = unwrapNetworkError(error)
    const direct = routerErrorBodySchema.safeParse(raw)
    if (direct.success) return direct.data
    const data = (raw as Maybe<{ data?: unknown }>)?.data
    const wrapped = routerErrorBodySchema.safeParse(data)
    return wrapped.success ? wrapped.data : null
}
