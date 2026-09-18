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

/** Maximum addresses per bulk-read request. Conservative — tune if backend allows more. */
export const NFD_BULK_CHUNK_SIZE = 50

/** Max bulk-read requests in flight when a lookup spans several chunks. */
export const NFD_BULK_CONCURRENCY = 2

/** How long a cached row (positive or negative) is considered fresh. */
export const NFD_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * Quiet period before a batch dispatches. Debounced, so a scroll that keeps
 * mounting rows keeps deferring — one request when the user settles instead of
 * one every window. NFD names are decorative, so trading latency for far fewer
 * requests is the right way round.
 */
export const NFD_BATCH_DEBOUNCE_MS = 100

/**
 * Dispatch immediately at this many pending addresses. Matched to
 * {@link NFD_BULK_CHUNK_SIZE} so a full batch is exactly one request, never a
 * chunk fan-out.
 */
export const NFD_BATCH_MAX_SIZE = NFD_BULK_CHUNK_SIZE

/**
 * Ceiling on debounce deferral, from the first enqueue of a window. Without it
 * a slow trickle of enqueues — each one restarting the debounce but never
 * reaching {@link NFD_BATCH_MAX_SIZE} — would defer forever and leave every row
 * unlabelled.
 *
 * A pure backstop, deliberately far longer than a scroll gesture. A row renders
 * its truncated address until its name arrives, so a resolution mid-scroll is a
 * visible text swap. At a ceiling near the gesture's own timescale this fires
 * repeatedly while scrolling and those swaps arrive as periodic waves — more
 * noticeable than either extreme. Set it past the gesture and the debounce
 * decides instead: names land once scrolling settles, in one pass.
 *
 * Distinct counterparties accumulate slower than rows do, so
 * {@link NFD_BATCH_MAX_SIZE} often does not trip during a scroll and this value
 * is what governs.
 */
export const NFD_BATCH_MAX_WAIT_MS = 4000
