/*
 Copyright 2022-2025 Pera Wallet, LDA
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
 * Zod schema for the wire shape of an ARC-60 sign-data request (`StdSigData` +
 * `Metadata`). `data`, `signer`, `domain`, `authenticatorData` are required
 * strings on the wire; `authenticatorData` is base64 and is decoded after
 * parsing. The sole source of truth for the wire shape — shared by every
 * transport that carries ARC-60 (WalletConnect, Liquid Auth) so the validation
 * can't drift. Do not duplicate typeof checks elsewhere.
 */
export const arc60PayloadSchema = z.object({
    data: z.string(),
    signer: z.string().min(1),
    domain: z.string().min(1),
    authenticatorData: z.string().min(1),
    requestId: z.string().optional(),
    hdPath: z.string().optional(),
    metadata: z.object({
        scope: z.number().int(),
        encoding: z.string().min(1),
    }),
})
