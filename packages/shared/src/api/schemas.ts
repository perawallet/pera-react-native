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
 * Response-side uint64 id (asset id, app id), normalized to a decimal string.
 *
 * JSON parses numbers as IEEE-754 doubles, so an id above 2^53 - 1 rounds
 * before any transformer runs. `parsePrecisionSafeJson` surfaces those as
 * strings, hence the union — ids must never live in a JS `number`.
 */
export const uint64IdSchema = z
    .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
    .transform(value => String(value))

/**
 * Request-side, where the wire format demands a JSON number. `.int()` restricts
 * to safe integers, so an inexact id fails validation instead of being sent
 * rounded. See `uint64IdToNumber` for building such payloads.
 */
export const uint64IdNumberSchema = z.number().int().nonnegative()
