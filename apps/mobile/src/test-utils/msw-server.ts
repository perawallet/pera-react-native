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

import { setupServer } from 'msw/node'
import {
    mockAlgodPendingTransaction,
    mockAlgodStatusAfterBlock,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { mockGetCurrency } from '@perawallet/wallet-core-currencies/test-handlers'
import { mockNfdBulkRead } from '@perawallet/wallet-core-nfd/test-handlers'

// Shared MSW server for integration tests. Starts with only the ambient
// baseline handlers below — tests opt in per-scenario via `server.use(...)`,
// importing factories from each domain package's `*/test-handlers` barrel and
// fixtures from `__integration__/__fixtures__/`. This keeps the contract
// explicit: unhandled requests warn, surfacing missing mocks immediately.
//
// Baseline handlers cover background services that fire in nearly every flow
// regardless of scenario. They survive `server.resetHandlers()`; tests can
// still override them with `server.use(...)`.
export const server = setupServer(
    // The NFD batch queue bulk-reads names for any address rendered on
    // screen. Unhandled, the request escapes to staging, 403s, and
    // error-logs after the test ends — racing vitest's worker teardown
    // ("Closing rpc while onUserConsoleLog was pending") and failing CI.
    mockNfdBulkRead({ response: { results: [] } }),
    // The preferred-currency query (default USD) fires from any screen that
    // renders a fiat value — same escape-to-staging teardown race as above
    // (it has failed CI runs blaming whichever integration file happened to
    // be last). Tests exercising currency behavior override via server.use.
    mockGetCurrency({
        id: 'USD',
        response: {
            currency_id: 'USD',
            name: 'US Dollar',
            symbol: '$',
            exchange_price: '1',
            usd_value: '1',
        },
    }),
    // Every submit flow leaves algosdk's waitForConfirmation polling these two
    // in the background — submitAndAutoRefresh returns before it settles and
    // swallows the outcome. Unhandled, that was 78 of the 102 requests the
    // integration suite sent to the real node per run, each landing after its
    // test had finished. 404 matches what the node already says about a
    // fabricated test txid, so the wait fails and is swallowed exactly as
    // before; a confirmed round would instead fire the post-confirmation
    // balance refresh and invent traffic no test asked for. Tests that do
    // exercise confirmation override both via server.use.
    mockAlgodPendingTransaction(),
    mockAlgodStatusAfterBlock(),
)

export { http, HttpResponse } from 'msw'
