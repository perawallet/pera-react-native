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

import { useCallback, useLayoutEffect } from 'react'
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWSkeleton,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useNavigation } from '@react-navigation/native'
import { useLanguage } from '@hooks/useLanguage'
import {
    StakingErrorBoundary,
    StakingProjectCard,
} from '@modules/staking/components'
import type { StakingProject } from '@modules/staking/models'
import { useBottomSafeAreaPadding } from '@hooks/useBottomSafeAreaPadding'
import { useStakingScreen } from './useStakingScreen'
import { useStyles } from './styles'

const SKELETON_COUNT = 5

export const StakingScreen = () => {
    const bottomPadding = useBottomSafeAreaPadding()
    const styles = useStyles(bottomPadding)
    const { t } = useLanguage()
    const navigation = useNavigation()
    const {
        projects,
        isLoading,
        isError,
        handleRetry,
        handleProjectPress,
        handleHelpOpen,
    } = useStakingScreen()

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <PWTouchableOpacity
                    onPress={handleHelpOpen}
                    testID='staking-help-button'
                >
                    <PWIcon name='question-mark' />
                </PWTouchableOpacity>
            ),
        })
    }, [navigation, handleHelpOpen])

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
        <PWView
            style={styles.container}
            testID='staking-screen'
        >
            <StakingErrorBoundary t={t}>
                <PWText
                    style={styles.subtitle}
                    testID='staking-subtitle'
                >
                    {t('staking.subtitle')}
                </PWText>

                {isLoading && (
                    <LoadingView
                        variant='skeleton'
                        count={SKELETON_COUNT}
                        style={styles.skeletonContainer}
                        renderSkeleton={index => (
                            <PWView
                                key={index}
                                style={styles.skeletonCard}
                                testID='staking-skeleton'
                            >
                                <PWSkeleton
                                    circle
                                    style={styles.skeletonLogo}
                                />
                                <PWView style={styles.skeletonContent}>
                                    <PWSkeleton style={styles.skeletonTitle} />
                                    <PWSkeleton
                                        style={styles.skeletonDescription}
                                    />
                                    <PWSkeleton style={styles.skeletonTvlRow} />
                                </PWView>
                            </PWView>
                        )}
                    />
                )}

                {!isLoading && isError && (
                    <PWView
                        style={styles.errorContainer}
                        testID='staking-error-container'
                    >
                        <PWText
                            variant='h4'
                            style={styles.errorTitle}
                            testID='staking-error-title'
                        >
                            {t('staking.error_title')}
                        </PWText>
                        <PWText
                            style={styles.errorDescription}
                            testID='staking-error-description'
                        >
                            {t('staking.error_description')}
                        </PWText>
                        <PWButton
                            variant='primary'
                            title={t('staking.retry')}
                            onPress={handleRetry}
                            testID='staking-retry-button'
                        />
                    </PWView>
                )}

                {!isLoading && !isError && projects.length === 0 && (
                    <EmptyView
                        title={t('staking.empty_title')}
                        body={t('staking.empty_body')}
                        style={styles.emptyContainer}
                        testID='staking-empty-view'
                    />
                )}

                {!isLoading && !isError && projects.length > 0 && (
                    <PWFlatList
                        data={projects}
                        renderItem={renderProject}
                        keyExtractor={item => item.id}
                        style={styles.list}
                        contentContainerStyle={styles.listContentContainer}
                        testID='staking-projects-list'
                    />
                )}
            </StakingErrorBoundary>
        </PWView>
    )
}
