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

import type { ChainContext } from '@perawallet/wallet-core-chain-contract'

// The walk's idle window (`CHAIN_PROBE_IDLE_TIMEOUT_MS` in accounts) must stay
// above this, or a node read is cut just before it would have answered.
export const DISCOVERY_READ_CEILING_MS = 5000

type ReadContext = Pick<ChainContext, 'getEndpoints' | 'timeouts'>

/**
 * `ctx` with its read ceiling capped at `DISCOVERY_READ_CEILING_MS`, so a node that
 * hangs fails over or fails as a retryable timeout before the walk's idle
 * window cuts the batch. The ceiling is split across the endpoint list.
 */
export const withDiscoveryReadCeiling = (ctx: ReadContext): ReadContext => ({
    getEndpoints: () => ctx.getEndpoints(),
    timeouts: {
        ...ctx.timeouts,
        readMs: Math.min(ctx.timeouts.readMs, DISCOVERY_READ_CEILING_MS),
    },
})
