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

import type { SwapQuote } from '../models'

/**
 * How long a fetched quote stays executable on the client, even when the
 * router's own expiry is later: a paused confirm must not carry a minutes-old
 * price into execution.
 */
export const SWAP_QUOTE_TTL_MS = 60_000

/** A quote without a `fetchedAt` stamp predates the freshness contract, so it counts as stale. */
export const isQuoteFresh = (
    quote: SwapQuote,
    nowMs: number = Date.now(),
): boolean =>
    quote.fetchedAt !== undefined &&
    nowMs - quote.fetchedAt <= SWAP_QUOTE_TTL_MS &&
    nowMs < (quote.expiresAt ?? Number.POSITIVE_INFINITY)
