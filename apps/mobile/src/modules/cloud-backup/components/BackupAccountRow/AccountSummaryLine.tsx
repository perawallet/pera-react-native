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

import { useAccountSummaryQuery } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { useLanguage } from '@hooks/useLanguage'
import { useSummaryStyles } from './styles'

/** Reads the same cheap per-account SQL aggregate the account list already
 *  warms, so adding this line costs no extra query. */
export const AccountSummaryLine = ({ address }: { address: string }) => {
    const { t } = useLanguage()
    const styles = useSummaryStyles()
    const { holdingsCount, portfolioAlgoValue } =
        useAccountSummaryQuery(address)

    return (
        <PWView style={styles.line}>
            <PWText
                variant='body'
                style={styles.text}
            >
                {t('cloud_backup.accounts.asset_count', {
                    count: holdingsCount,
                })}
            </PWText>
            <PWText
                variant='body'
                style={styles.text}
            >
                {'・'}
            </PWText>
            <AssetAmount
                asset={ALGO_ASSET}
                value={portfolioAlgoValue}
                density='compact'
                variant='body'
                weight={400}
                style={styles.text}
            />
        </PWView>
    )
}
