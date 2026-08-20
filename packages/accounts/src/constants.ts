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

import { type ImportAccountType } from './models'

export const KEY_DOMAIN = 'pera.accounts'

// Max holdings per indexer page (account-syncer fallback path and the
// opt-in-rounds read share it).
export const HOLDINGS_PAGE_LIMIT = 1000

// gcTime for query entries that hold a hydrated per-holding row array, which
// scales with the account (tens of MB at 10k assets). The 1-hour default
// would retain every unobserved variant (filters, old network) and ratchet
// the heap into GC-pause territory (PERA-4953); SQLite re-reads are cheap, so
// release quickly instead.
export const HOLDINGS_ROWS_GC_TIME_MS = 60_000

export const MNEMONIC_WORD_COUNT: Record<ImportAccountType, number> = {
    hdWallet: 24,
    algo25: 25,
    // Quantum mnemonics collide with algo25 at 25 words. Key order matters:
    // resolveImportAccountType scans this record in insertion order, so
    // algo25 must stay ABOVE quantum for 25-word auto-detection to keep
    // resolving to algo25 (quantum import is explicit-only — PQ-009).
    quantum: 25,
}
