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

import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'

/** The wallet's own fee review has no requester to show. */
export const requesterSourceOf = (
    request: Optional<
        Pick<TransactionSignRequest, 'sourceType' | 'sourceMetadata'>
    >,
): Optional<TransactionSignRequest['sourceMetadata']> =>
    request?.sourceType === 'local-fee-review'
        ? undefined
        : request?.sourceMetadata
