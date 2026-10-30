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

import { PWText, PWView } from '@components/core'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { AssetAmount } from '@components/AssetAmount'
import { InfoButton } from '@components/InfoButton'
import { SheetOptionRow } from '@components/SheetOptionRow'
import { useLanguage } from '@hooks/useLanguage'
import type { AccountChainSectionProps } from '@modules/accounts'
import { useStyles } from './styles'
import { useAlgorandAccountSection } from './useAlgorandAccountSection'

export const AlgorandAccountSection = (props: AccountChainSectionProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const nativeAsset = useNativeAsset(props.scope)
    const { minBalance, isMinBalanceLoading, showMinBalance, options } =
        useAlgorandAccountSection(props)

    return (
        <PWView style={styles.container}>
            {showMinBalance && (
                <PWView
                    style={styles.minBalanceRow}
                    testID='account_algorand_min_balance'
                >
                    <PWText
                        variant='footnoteMedium'
                        style={styles.labelText}
                        truncate
                    >
                        {t('account_info.min_balance')}
                    </PWText>
                    <InfoButton
                        title={t('min_balance_info.title')}
                        trigger={
                            <AssetAmount
                                chainId={props.scope.chainId}
                                asset={nativeAsset}
                                value={minBalance}
                                showSymbol
                                symbolPosition='start'
                                isLoading={isMinBalanceLoading}
                                variant='bodyLarge'
                                weight={500}
                            />
                        }
                    >
                        <PWText style={styles.labelText}>
                            {t('min_balance_info.description')}
                        </PWText>
                    </InfoButton>
                </PWView>
            )}
            {options.map(option => (
                <SheetOptionRow
                    key={option.id}
                    option={option}
                />
            ))}
        </PWView>
    )
}
