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
import { MAX_DATA_SIGN_REQUESTS } from '../constants'
import { BASE64_PATTERN } from './arc60-wire'

/** Per-item cap in base64 characters (~12 KiB decoded), matching ARC-60's `data` cap. */
export const LEGACY_DATA_MAX_ITEM_CHARS = 16 * 1024

/** Whole-request cap across every item's `data` and `message`, in characters. */
export const LEGACY_DATA_MAX_REQUEST_CHARS = 256 * 1024

// Shared by every transport that accepts the legacy arbitrary-data shape, like
// `arc60WireSchema` for ARC-60. Signer authorization stays with each transport.
export const legacyArbitraryDataWireSchema = z
    .array(
        z.object({
            data: z
                .string()
                .max(LEGACY_DATA_MAX_ITEM_CHARS)
                .regex(BASE64_PATTERN),
            signer: z.string().min(1).max(128),
            /** WalletConnect v1 wire concept; the v1 handler is what checks it. */
            chainId: z.number().optional(),
            message: z.string().max(LEGACY_DATA_MAX_ITEM_CHARS).optional(),
        }),
    )
    .min(1)
    .max(MAX_DATA_SIGN_REQUESTS)
    .refine(
        items =>
            items.reduce(
                (total, item) =>
                    total + item.data.length + (item.message?.length ?? 0),
                0,
            ) <= LEGACY_DATA_MAX_REQUEST_CHARS,
        'request exceeds the maximum allowed size',
    )
