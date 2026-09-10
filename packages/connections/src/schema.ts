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
 * The resolver's own schema, not a copy: zod strips undeclared keys, so any
 * divergence would silently disarm a resolver refusal (a dropped `msig` turns
 * a 4200 into an ordinary signing sheet).
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
