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
import { AssetAmount } from '@components/AssetAmount'
import { TransactionIcon } from '@components/TransactionIcon'
import type { TransactionDetailSummary } from '../../types'
import { TransactionStatusBadge } from '../../TransactionStatusBadge'
import { TransactionDetailHeroAmount } from './TransactionDetailHeroAmount'
import { useStyles } from './styles'

type TransactionDetailHeroProps = {
    summary: TransactionDetailSummary
}

export const TransactionDetailHero = ({
    summary,
}: TransactionDetailHeroProps) => {
    const styles = useStyles()
    const { scope, iconName, title, status, amount, isAmountLoading } = summary

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                size='md'
                name={iconName}
                style={styles.icon}
            />
            <PWView style={styles.heading}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    style={styles.title}
                >
                    {title}
                </PWText>
                {!!amount && (
                    <TransactionDetailHeroAmount
                        amount={amount}
                        scope={scope}
                    />
                )}
                {!amount && !!isAmountLoading && (
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={undefined}
                        value={undefined}
                        isLoading
                        variant='titleSmall'
                    />
                )}
            </PWView>
            <TransactionStatusBadge status={status} />
        </PWView>
    )
}
