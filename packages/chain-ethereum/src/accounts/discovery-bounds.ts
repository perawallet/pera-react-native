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

import type { RequestConfiguration } from '@perawallet/wallet-core-shared'

// A discovery GET runs once per quiet address on every chain, all through one
// shared gate: a retried 5xx or a 10s default timeout on a failing network
// would hold the gate long enough to stall the healthy chains' lookups too.
// The walk's idle window (`CHAIN_PROBE_IDLE_TIMEOUT_MS` in accounts) must stay
// above `timeout`, or a lookup is cut just before it would have answered.
export const DISCOVERY_LOOKUP_BOUNDS = {
    timeout: 5000,
    retry: { limit: 0 },
} satisfies Pick<RequestConfiguration, 'timeout' | 'retry'>
