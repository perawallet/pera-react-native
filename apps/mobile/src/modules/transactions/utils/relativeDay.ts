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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { formatISODate, type Optional } from '@perawallet/wallet-core-shared'

const TODAY = i18nKey('transactions.filter.today')
const YESTERDAY = i18nKey('transactions.filter.yesterday')

/**
 * "Today" or "Yesterday" for a date header whose key is that local-time ISO
 * date (`YYYY-MM-DD`), else undefined so the header keeps its own date.
 */
export const relativeDayKeyOf = (
    isoDate: string,
    now: Date = new Date(),
): Optional<I18nKey> => {
    const day = new Date(now)
    if (isoDate === formatISODate(day)) return TODAY
    // A calendar step, not 24h back, which lands on the wrong day across a DST change.
    day.setDate(day.getDate() - 1)
    return isoDate === formatISODate(day) ? YESTERDAY : undefined
}
