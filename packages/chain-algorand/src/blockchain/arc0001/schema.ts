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
import {
    ARC0001_MAX_TXN_B64_LENGTH,
    MAX_ADDRESS_LENGTH,
    MAX_ADDRESS_LIST_LENGTH,
    MAX_MESSAGE_LENGTH,
} from './limits'

export { ARC0001_MAX_TXN_B64_LENGTH }

// Spec: "wallets SHALL NOT rely on TypeScript typing" — validate the wire
// shape before reading any field. Semantic rules live in the resolver;
// strict mode here enforces "reject unknown extra fields".
const arc0001MsigSchema = z
    .object({
        version: z.number().int(),
        threshold: z.number().int(),
        addrs: z
            .array(z.string().min(1).max(MAX_ADDRESS_LENGTH))
            .max(MAX_ADDRESS_LIST_LENGTH),
    })
    .strict()

const arc0001WalletTransactionSchema = z
    .object({
        txn: z.string().min(1).max(ARC0001_MAX_TXN_B64_LENGTH),
        signers: z
            .array(z.string().max(MAX_ADDRESS_LENGTH))
            .max(MAX_ADDRESS_LIST_LENGTH)
            .optional(),
        authAddr: z.string().max(MAX_ADDRESS_LENGTH).optional(),
        msig: arc0001MsigSchema.optional(),
        stxn: z.string().max(ARC0001_MAX_TXN_B64_LENGTH).optional(),
        message: z.string().max(MAX_MESSAGE_LENGTH).optional(),
        groupMessage: z.string().max(MAX_MESSAGE_LENGTH).optional(),
    })
    .strict()

export const arc0001SignTxnRequestSchema = z.array(
    arc0001WalletTransactionSchema,
)
