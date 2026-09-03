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
import { arc0001SignTxnRequestSchema } from '@perawallet/wallet-core-blockchain'
import { MAX_DATA_SIGN_REQUESTS } from '@perawallet/wallet-core-signing'

/**
 * ARC-0001 request: one entry per transaction slot. The shape is the
 * resolver's own schema, not a copy: zod strips what it does not declare and
 * a strict object rejects what it does not recognise, so any divergence here
 * would silently disarm one of the resolver's refusals — a dropped `msig` or
 * `stxn` turns a 4200 into an ordinary signing sheet, and a stripped unknown
 * key turns a 4300 into a signable group.
 */
export const arc0001GroupSchema = arc0001SignTxnRequestSchema.min(1)

export const legacyArbitraryDataSchema = z
    .array(
        z.object({
            data: z.string(),
            signer: z.string(),
            /** WalletConnect v1 wire concept; the v1 handler is what checks it. */
            chainId: z.number().optional(),
            message: z.string().optional(),
        }),
    )
    .min(1)
    .max(MAX_DATA_SIGN_REQUESTS)
