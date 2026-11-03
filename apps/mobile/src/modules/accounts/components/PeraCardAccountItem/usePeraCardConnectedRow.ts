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

import { CardStatus, useCardStatusQuery } from '@perawallet/wallet-core-card'
import {
    i18nKey,
    type ChainScope,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

const PAN_MASK = '••••'

const STATUS_LABEL_KEYS: Record<
    Exclude<CardStatus, typeof CardStatus.Active>,
    I18nKey
> = {
    [CardStatus.Frozen]: i18nKey('peraCard.account_item.status_frozen'),
    [CardStatus.Blocked]: i18nKey('peraCard.account_item.status_blocked'),
    [CardStatus.Pending]: i18nKey('peraCard.account_item.status_pending'),
}

export type UsePeraCardConnectedRowResult = {
    /**
     * The masked card number while the card is active, otherwise its status.
     * Null until the status loads, so the row never shows a guessed state.
     */
    statusLabel: Nullable<string>
}

export const usePeraCardConnectedRow = (
    scope: ChainScope,
): UsePeraCardConnectedRowResult => {
    const { t } = useLanguage()
    const { data: card } = useCardStatusQuery(scope)

    if (!card) return { statusLabel: null }

    if (card.status === CardStatus.Active) {
        return {
            statusLabel: card.panLast4 ? `${PAN_MASK} ${card.panLast4}` : null,
        }
    }

    return { statusLabel: t(STATUS_LABEL_KEYS[card.status]) }
}
