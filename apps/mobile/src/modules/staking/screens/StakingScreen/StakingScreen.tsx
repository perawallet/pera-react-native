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

import { useCallback } from 'react'
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWScreen,
    PWSkeleton,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import {
    StakingErrorBoundary,
    StakingProjectCard,
} from '@modules/staking/components'
import type { StakingProject } from '@modules/staking/models'
import { useStakingScreen } from './useStakingScreen'
import { useStyles } from './styles'

const SKELETON_COUNT = 5

export const StakingScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        projects,
        isLoading,
        isError,
        isOffline,
        handleRetry,
        handleProjectPress,
        handleHelpOpen,
    } = useStakingScreen()

    useNavigationHeader({
        right: (
            <PWTouchableOpacity
                onPress={handleHelpOpen}
                testID='staking-help-button'
            >
                <PWIcon name='question-mark' />
            </PWTouchableOpacity>
        ),
    })

    const renderProject = useCallback(
        ({ item, index }: { item: StakingProject; index: number }) => {
            return (
                <StakingProjectCard
                    project={item}
                    isLast={index === projects.length - 1}
                    onPress={project => void handleProjectPress(project)}
                />
            )
        },
        [handleProjectPress, projects.length],
    )

    const keyExtractor = useCallback((item: StakingProject) => item.id, [])

    return (
        <PWScreen
            scroll='never'
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

                {/* Only the offline arm is delegated — staking keeps its own
                    branded error container below. */}
                <OfflineTolerantView
                    isOffline={isOffline}
                    onRetry={handleRetry}
                    retryLabel={t('staking.retry')}
                    offlineTestID='staking-offline-view'
                >
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
                                        <PWSkeleton
                                            style={styles.skeletonTitle}
                                        />
                                        <PWSkeleton
                                            style={styles.skeletonDescription}
                                        />
                                        <PWSkeleton
                                            style={styles.skeletonTvlRow}
                                        />
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
                            testID='staking-empty-view'
                        />
                    )}

                    {!isLoading && !isError && projects.length > 0 && (
                        <PWView
                            testID='staking-projects-list'
                            style={styles.list}
                        >
                            <PWFlatList
                                data={projects}
                                renderItem={renderProject}
                                ItemSeparatorComponent={null}
                                keyExtractor={keyExtractor}
                                style={styles.list}
                            />
                        </PWView>
                    )}
                </OfflineTolerantView>
            </StakingErrorBoundary>
        </PWScreen>
    )
}
