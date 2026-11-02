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

import { useCallback } from 'react'
import {
    i18nKey,
    type LocalizedText,
} from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'

// Left bare: the generic label already says "Transaction", and an interpreted
// title is the backend's own free text.
const BARE_KEYS: ReadonlySet<string> = new Set([
    i18nKey('transactions.list_item.default'),
    i18nKey('transactions.list_item.interpreted_title'),
])

/** Names a detail hero as its history row does, as "<row label> Transaction". */
export const useTransactionHeroTitle = (): ((
    title: LocalizedText,
) => string) => {
    const { t } = useLanguage()
    return useCallback(
        ({ key, params }: LocalizedText) => {
            const label = t(key, params)
            return BARE_KEYS.has(key)
                ? label
                : t('transactions.common.typed_title', { type: label })
        },
        [t],
    )
}
