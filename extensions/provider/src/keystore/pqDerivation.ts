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

/**
 * Must equal `PQ_DERIVATION_LEGACY`/`PQ_DERIVATION_CANONICAL` from
 * `@perawallet/wallet-core-kms` (PERA-4972). Not imported: kms already
 * depends on this package, so the reverse edge would close a build-order
 * cycle. Both sides now pin the literals in a test —
 * `migrations/repairs/0004-stamp-quantum-derivation.ts`'s spec asserts the
 * stamped value is `'legacy'`, and `packages/kms/src/models/__tests__/keys.test.ts`
 * asserts both literals directly.
 */
export const PQ_DERIVATION_LEGACY = 'legacy'
export const PQ_DERIVATION_CANONICAL = 'pqk1'

export type PQDerivation =
    | typeof PQ_DERIVATION_LEGACY
    | typeof PQ_DERIVATION_CANONICAL
