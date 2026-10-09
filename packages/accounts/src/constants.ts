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

export const KEY_DOMAIN = 'pera.accounts'

// gcTime for query entries that hold a hydrated per-holding row array, which
// scales with the account (tens of MB at 10k assets). The 1-hour default
// would retain every unobserved variant (filters, old network) and ratchet
// the heap into GC-pause territory; SQLite re-reads are cheap, so
// release quickly instead.
export const HOLDINGS_ROWS_GC_TIME_MS = 60_000
