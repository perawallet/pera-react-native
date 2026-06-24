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

// Defence-in-depth size bounds on untrusted dApp/peer input, applied before
// the resolver base64+msgpack-decodes each entry (see resolve.ts). All are
// generous relative to real Algorand limits — they exist to cap allocation/
// parse work on a hostile payload, not to enforce protocol rules.
//
// A signed/unsigned txn is at most a few KB; 64 KB of base64 (~48 KB decoded)
// leaves ample headroom. Addresses are 58-char base32; 128 covers any encoding.
// Multisig participants top out at 255 on-chain.
const MAX_TXN_B64_LENGTH = 64 * 1024
const MAX_MESSAGE_LENGTH = 4 * 1024
const MAX_ADDRESS_LENGTH = 128
const MAX_ADDRESS_LIST_LENGTH = 256

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
        txn: z.string().min(1).max(MAX_TXN_B64_LENGTH),
        signers: z
            .array(z.string().max(MAX_ADDRESS_LENGTH))
            .max(MAX_ADDRESS_LIST_LENGTH)
            .optional(),
        authAddr: z.string().max(MAX_ADDRESS_LENGTH).optional(),
        msig: arc0001MsigSchema.optional(),
        stxn: z.string().max(MAX_TXN_B64_LENGTH).optional(),
        message: z.string().max(MAX_MESSAGE_LENGTH).optional(),
        groupMessage: z.string().max(MAX_MESSAGE_LENGTH).optional(),
    })
    .strict()

export const arc0001SignTxnRequestSchema = z.array(
    arc0001WalletTransactionSchema,
)
