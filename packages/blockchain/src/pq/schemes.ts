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

import { FALCON_1024_SCHEME } from 'algosdk'

/**
 * Post-quantum signature schemes this wallet can produce.
 *
 * The transaction wire format carries the scheme as a 2-byte identifier
 * alongside the public key and signature. Keys are the scheme-agnostic ids
 * used across the app; values are the wire identifiers understood by the
 * protocol ('f1' for Falcon-1024).
 *
 * **What is scheme-agnostic:** the transaction assembly and signing path.
 * `PQSignature`, `assemblePQSignedTransaction`, `pqSigningDigest`,
 * `deriveQuantumAddress`, `PQSignatureProvider` and
 * `useLocalKeyTransactionSigner` all carry `PQSchemeId` through generically —
 * a second scheme needs no new types there and no new signing branch.
 *
 * **What is NOT** — two single-scheme assumptions a second scheme must fix
 * first, both out of scope here:
 *
 * 1. **Fee shape.** `fees/feeCalculator.ts`'s `CalculateMinTxnFeeParams` has a
 *    single `pqMultiplier` and a boolean `isPQSigner`. One multiplier cannot
 *    express two schemes with very different signature sizes (Falcon-1024 is
 *    ~1.2 KB, ML-DSA-65 ~3.3 KB), and `isPQSigner` is derived from
 *    `isQuantumAccount(authAccount)` in the fee path, where the account carries
 *    no scheme — so the scheme is not even retrievable there. Supporting a
 *    second scheme means making the multiplier scheme-keyed and threading the
 *    scheme (not a boolean) into fee calculation.
 * 2. **Key ids.** `quantumSignKeyId(seedId)` (`packages/kms/src/models/keys.ts`)
 *    yields exactly one child id per seed (`${seedId}-quantum`), so one seed
 *    cannot host two schemes without an id collision. Per-seed multi-scheme
 *    support means keying that id by scheme too.
 */
export const PQ_SCHEMES = {
    falcon1024: FALCON_1024_SCHEME,
} as const

export type PQSchemeId = keyof typeof PQ_SCHEMES

export const DEFAULT_PQ_SCHEME_ID: PQSchemeId = 'falcon1024'
