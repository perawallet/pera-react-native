/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import type { StakingProject } from '../../models'
import { StakingTypeBadge } from '../StakingTypeBadge'
import { useStyles } from './styles'

export type StakingProjectCardProps = {
    project: StakingProject
    isLast?: boolean
    onPress: (project: StakingProject) => void
}

export const StakingProjectCard = ({
    project,
    isLast = false,
    onPress,
}: StakingProjectCardProps) => {
    const styles = useStyles({ isLast })
    const { preferredFiatCurrency, usdToPreferred } = useCurrency()

    const tvlInPreferredCurrency = useMemo(
        () => usdToPreferred(new Decimal(project.tvlInUsd)),
        [usdToPreferred, project.tvlInUsd],
    )

    const handlePress = useCallback(() => {
        onPress(project)
    }, [onPress, project])

    return (
        <PWTouchableOpacity
            style={styles.card}
            onPress={handlePress}
            testID={`staking-project-card-${project.id}`}
        >
            <PWImage
                source={{ uri: project.logoUrl }}
                style={styles.logo}
                resizeMode='cover'
            />

            <PWView style={styles.content}>
                <PWView style={styles.headerTextContainer}>
                    <PWText
                        variant='h4'
                        numberOfLines={1}
                    >
                        {project.title}
                    </PWText>
                    <StakingTypeBadge type={project.type} />
                </PWView>

                <PWText style={styles.description}>
                    {project.description}
                </PWText>

                {project.tvlInAlgo > 0 && (
                    <PWView style={styles.tvlRow}>
                        <PWIcon
                            name='locked'
                            size='sm'
                        />
                        <PWText style={styles.tvlLabel}>TVL</PWText>
                        <PWView style={styles.tvlValueContainer}>
                            <CurrencyDisplay
                                currency='ALGO'
                                value={new Decimal(project.tvlInAlgo)}
                                precision={2}
                                truncateToUnits
                                showSymbol
                                style={styles.tvlAlgoValue}
                            />
                            <PWView style={styles.tvlFiatContainer}>
                                <PWText style={styles.tvlFiatValue}>
                                    {'('}
                                </PWText>
                                <CurrencyDisplay
                                    currency={preferredFiatCurrency}
                                    value={tvlInPreferredCurrency}
                                    precision={2}
                                    truncateToUnits
                                    showSymbol
                                    style={styles.tvlFiatValue}
                                />
                                <PWText style={styles.tvlFiatValue}>
                                    {')'}
                                </PWText>
                            </PWView>
                        </PWView>
                    </PWView>
                )}
            </PWView>
        </PWTouchableOpacity>
    )
}
