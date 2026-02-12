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

import { useCallback } from 'react'
import { Decimal } from 'decimal.js'
import { formatNumber, formatWithUnits } from '@perawallet/wallet-core-shared'
import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { StakingProject } from '../../models'
import { StakingTypeBadge } from '../StakingTypeBadge'
import { useStyles } from './styles'

const formatCompactValue = (value: number): string => {
    const { amount, unit } = formatWithUnits(new Decimal(value))
    const { integer, fraction } = formatNumber(amount, 2)

    return `${integer}${fraction}${unit}`
}

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
                            <PWText style={styles.tvlAlgoValue}>
                                {`${formatCompactValue(project.tvlInAlgo)} ALGO`}
                            </PWText>
                            <PWText style={styles.tvlUsdValue}>
                                {`($${formatCompactValue(project.tvlInUsd)})`}
                            </PWText>
                        </PWView>
                    </PWView>
                )}
            </PWView>
        </PWTouchableOpacity>
    )
}
