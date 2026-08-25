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

export const ASSET_BULK_CHUNK_SIZE = 100
export const ASSET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days — asset
// metadata rarely
// changes, so the
// TTL can be longer
// than NFD's

/** Recheck cadence for an asset the backend has not classified yet. */
export const ASSET_RECLASSIFY_TTL_MS = 5 * 60 * 1000

// Covers the backend crawler's worst case: its slow-creator retry path backs
// off 15-30 minutes per attempt. After this the asset falls back to
// ASSET_CACHE_TTL_MS.
export const ASSET_NEWLY_SEEN_WINDOW_MS = 6 * 60 * 60 * 1000
