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

import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { UseSendTotalResult } from './useSendTotal'
import { useStyles } from './styles'

export const SendTotalRow = ({ total }: { total: UseSendTotalResult }) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <KeyValueRow
            title={t('send_funds.confirmation.total')}
            testID='send_confirm_total'
        >
            {total.isPending ? (
                <AssetAmount
                    asset={undefined}
                    value={undefined}
                    isLoading
                />
            ) : (
                total.lines.map((line, index) => (
                    <AssetAmount
                        key={line.asset.assetId}
                        asset={line.asset}
                        value={line.amount}
                        prefix={index > 0 ? '+ ' : undefined}
                        showSymbol
                        ignorePrivacyMode
                        truncate={false}
                    />
                ))
            )}
            <PreferredAmount
                value={total.preferredValue}
                density='compact'
                isLoading={total.isPending || total.isPreferredPending}
                ignorePrivacyMode
                truncate={false}
                style={styles.secondaryAmount}
            />
        </KeyValueRow>
    )
}
