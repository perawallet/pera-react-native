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

import { PWImage, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { TransactionLeadingIcon } from '@components/TransactionLeadingIcon'
import { TransactionStatusBadge } from '@components/TransactionStatusBadge'
import { useLanguage } from '@hooks/useLanguage'
import type { TransactionDetailSummary } from '../../types'
import { TransactionDetailHeroAmount } from './TransactionDetailHeroAmount'
import { useStyles } from './styles'

type TransactionDetailHeroProps = {
    summary: TransactionDetailSummary
}

export const TransactionDetailHero = ({
    summary,
}: TransactionDetailHeroProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        scope,
        iconName,
        leadingAssets,
        title,
        projectName,
        projectLogoUrl,
        status,
        amount,
        isAmountLoading,
        headlineFiat,
    } = summary

    return (
        <PWView style={styles.container}>
            <TransactionLeadingIcon
                size='lg'
                iconName={iconName}
                leadingAssets={leadingAssets ?? []}
                chainIds={[scope.chainId]}
            />
            <PWText
                variant='bodyLarge'
                style={styles.title}
            >
                {title}
            </PWText>
            {!!projectName && (
                <PWView
                    style={styles.project}
                    testID='transaction_detail_project'
                >
                    {!!projectLogoUrl && (
                        <PWImage
                            source={{ uri: projectLogoUrl }}
                            style={styles.projectLogo}
                            showLoadingIndicator={false}
                            testID='transaction_detail_project_logo'
                        />
                    )}
                    <PWText truncate>
                        {t('transactions.common.via_project', {
                            name: projectName,
                        })}
                    </PWText>
                </PWView>
            )}
            {!!amount && (
                <TransactionDetailHeroAmount
                    amount={amount}
                    scope={scope}
                />
            )}
            {!amount && !isAmountLoading && !!headlineFiat && (
                <TransactionDetailHeroAmount
                    amount={headlineFiat}
                    scope={scope}
                    isFiatOnly
                />
            )}
            {!amount && !!isAmountLoading && (
                <AssetAmount
                    chainId={scope.chainId}
                    asset={undefined}
                    value={undefined}
                    isLoading
                    variant='h1'
                />
            )}
            {!!status && <TransactionStatusBadge status={status} />}
        </PWView>
    )
}
