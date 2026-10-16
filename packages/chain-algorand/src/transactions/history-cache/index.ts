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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { backfillMissingCloseAmounts } from './close-amount-backfill'
import { backfillSwapAssetFacts } from './swap-asset-facts-backfill'

export { algorandHistoryChainData } from './chain-data'

// The syncer only fetches transactions newer than the newest cached one, so
// nothing else ever revisits these rows. Each backfill swallows its own errors.
export async function healAlgorandCachedRows(params: {
    scope: ChainScope
    accountAddress: string
}): Promise<void> {
    await backfillMissingCloseAmounts(params)
    await backfillSwapAssetFacts(params)
}
