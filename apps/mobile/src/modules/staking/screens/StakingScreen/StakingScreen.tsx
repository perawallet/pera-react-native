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
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWSkeleton,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import {
    StakingDisclaimerSheet,
    StakingHelpSheet,
    StakingProjectCard,
} from '@modules/staking/components'
import type { StakingProject } from '@modules/staking/models'
import { useStakingScreen } from './useStakingScreen'
import { useStyles } from './styles'

const SKELETON_ITEMS = [0, 1, 2, 3, 4]

export const StakingScreen = () => {
    const styles = useStyles()
    const {
        projects,
        isLoading,
        isError,
        isHelpVisible,
        isDisclaimerVisible,
        handleBack,
        handleRetry,
        handleProjectPress,
        handleHelpOpen,
        handleHelpClose,
        handleDisclaimerAccept,
        handleDisclaimerClose,
    } = useStakingScreen()

    const renderProject = useCallback(
        ({ item, index }: { item: StakingProject; index: number }) => {
            return (
                <StakingProjectCard
                    project={item}
                    isLast={index === projects.length - 1}
                    onPress={handleProjectPress}
                />
            )
        },
        [handleProjectPress, projects.length],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                style={styles.toolbar}
                left={
                    <PWTouchableOpacity
                        onPress={handleBack}
                        testID='staking-back-button'
                    >
                        <PWIcon name='chevron-left' />
                    </PWTouchableOpacity>
                }
                center={<PWText variant='h3'>Stake on Algorand</PWText>}
                right={
                    <PWTouchableOpacity
                        onPress={handleHelpOpen}
                        testID='staking-help-button'
                    >
                        <PWIcon name='question-mark' />
                    </PWTouchableOpacity>
                }
            />

            <PWText style={styles.subtitle}>
                Secure the protocol and receive Staking Rewards!
            </PWText>

            {isLoading && (
                <PWView style={styles.skeletonContainer}>
                    {SKELETON_ITEMS.map(item => (
                        <PWView
                            key={`staking-skeleton-${item}`}
                            style={styles.skeletonCard}
                            testID='staking-skeleton'
                        >
                            <PWSkeleton
                                circle
                                height={40}
                                width={40}
                            />
                            <PWView style={styles.skeletonContent}>
                                <PWSkeleton style={styles.skeletonTitle} />
                                <PWSkeleton
                                    style={styles.skeletonDescription}
                                />
                                <PWSkeleton style={styles.skeletonTvlRow} />
                            </PWView>
                        </PWView>
                    ))}
                </PWView>
            )}

            {!isLoading && isError && (
                <PWView style={styles.errorContainer}>
                    <PWText
                        variant='h4'
                        style={styles.errorTitle}
                    >
                        Failed to load staking projects
                    </PWText>
                    <PWText style={styles.errorDescription}>
                        Please try again in a moment.
                    </PWText>
                    <PWButton
                        variant='primary'
                        title='Retry'
                        onPress={handleRetry}
                    />
                </PWView>
            )}

            {!isLoading && !isError && (
                <PWFlatList
                    data={projects}
                    renderItem={renderProject}
                    keyExtractor={item => item.id}
                    style={styles.list}
                    contentContainerStyle={styles.listContentContainer}
                />
            )}

            <StakingHelpSheet
                isVisible={isHelpVisible}
                onClose={handleHelpClose}
            />

            <StakingDisclaimerSheet
                isVisible={isDisclaimerVisible}
                onAccept={handleDisclaimerAccept}
                onClose={handleDisclaimerClose}
            />
        </PWView>
    )
}
