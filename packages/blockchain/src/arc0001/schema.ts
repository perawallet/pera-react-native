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

// Spec: "wallets SHALL NOT rely on TypeScript typing" — validate the wire
// shape before reading any field. Semantic rules live in the resolver;
// strict mode here enforces "reject unknown extra fields".
const arc0001MsigSchema = z
    .object({
        version: z.number().int(),
        threshold: z.number().int(),
        addrs: z.array(z.string().min(1)),
    })
    .strict()

const arc0001WalletTransactionSchema = z
    .object({
        txn: z.string().min(1),
        signers: z.array(z.string()).optional(),
        authAddr: z.string().optional(),
        msig: arc0001MsigSchema.optional(),
        stxn: z.string().optional(),
        message: z.string().optional(),
        groupMessage: z.string().optional(),
    })
    .strict()

export const arc0001SignTxnRequestSchema = z.array(
    arc0001WalletTransactionSchema,
)
