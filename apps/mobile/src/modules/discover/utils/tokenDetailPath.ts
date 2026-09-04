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

import { isAlgoAssetId } from '@perawallet/wallet-core-shared'

// Discover serves ALGO from a dedicated `token-detail/ALGO` route; `token-detail/0`
// falls through to the generic asset page, whose `/discover/assets/0/` fetch 404s.
export const toDiscoverTokenDetailPath = (assetId: string): string =>
    `token-detail/${isAlgoAssetId(assetId) ? 'ALGO' : assetId}`
