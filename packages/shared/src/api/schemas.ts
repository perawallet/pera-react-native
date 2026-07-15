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

/**
 * uint64 identifier field (asset id, app id) in an API response.
 *
 * JSON parses numbers as IEEE-754 doubles, so an id above 2^53 - 1 would be
 * rounded before any transformer can run. The query client's
 * `parsePrecisionSafeJson` surfaces such ids as decimal strings; this schema
 * accepts both the common number form and the big-id string form and
 * normalizes to a string — ids must never live in a JS `number`.
 *
 * Output: decimal string.
 */
export const uint64IdSchema = z
    .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
    .transform(value => String(value))

/**
 * uint64 identifier field in a *request* whose wire format requires a JSON
 * number. `.int()` (zod 4) restricts to safe integers, so an id that
 * cannot be represented exactly fails validation instead of being sent
 * rounded — see also `uint64IdToNumber` for building such payloads.
 */
export const uint64IdNumberSchema = z.number().int().nonnegative()
