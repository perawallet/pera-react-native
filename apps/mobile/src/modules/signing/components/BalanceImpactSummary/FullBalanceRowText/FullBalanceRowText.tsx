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

import { PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { BalanceImpactItem } from '../useBalanceImpactSummary'
import { BalanceImpactSubtitle } from '../BalanceImpactSubtitle'

export type FullBalanceRowTextProps = {
    item: BalanceImpactItem
}

// A close-remainder/close-to sweeps the whole balance, so the explicit
// `amount` understates the outflow — present it as the full balance instead
// of a misleadingly small figure.
export const FullBalanceRowText = ({ item }: FullBalanceRowTextProps) => {
    const { t } = useLanguage()
    return (
        <>
            <PWText
                variant='body'
                numberOfLines={1}
            >
                {t('signing.balance_impact.entire_balance', {
                    unit: item.asset.unitName ?? item.assetId,
                })}
            </PWText>
            <BalanceImpactSubtitle>
                {t('signing.balance_impact.closes_balance')}
            </BalanceImpactSubtitle>
        </>
    )
}
