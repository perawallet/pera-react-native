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

import type { TransactionNotice } from '@perawallet/wallet-core-chain-contract'
import {
    formatDatetime,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { ChainNoticeProps } from './ChainNotice'

export type ChainNoticeContent = Pick<
    ChainNoticeProps,
    'kind' | 'titleKey' | 'params'
>

/** Resolves a summary's notice into ChainNotice props, formatting `since` into the `since` param. */
export const chainNoticeOf = (
    notice: Optional<TransactionNotice>,
): Nullable<ChainNoticeContent> => {
    if (!notice) return null
    const { kind, title, since } = notice
    const params =
        since === undefined
            ? title.params
            : {
                  ...title.params,
                  since: formatDatetime(new Date(since), undefined, 'short'),
              }
    return { kind, titleKey: title.key, ...(params && { params }) }
}
