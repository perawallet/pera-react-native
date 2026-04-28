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

import { PWView } from '@components/core'
import { useStyles } from './styles'

const PERIOD_BUTTON_COUNT = 5
const ACTION_BUTTON_COUNT = 4

export const AccountOverviewHeaderSkeleton = () => {
    const styles = useStyles()

    return (
        <PWView style={styles.skeletonRoot}>
            <PWView style={styles.valueBarContainer}>
                <PWView style={styles.valueBar}>
                    <PWView
                        style={[
                            styles.skeletonBlock,
                            styles.skeletonPrimaryValue,
                        ]}
                    />
                </PWView>
                <PWView style={styles.secondaryValueBar}>
                    <PWView
                        style={[
                            styles.skeletonBlock,
                            styles.skeletonSecondaryValue,
                        ]}
                    />
                    <PWView
                        style={[styles.skeletonBlock, styles.skeletonTrend]}
                    />
                </PWView>
            </PWView>
            <PWView style={styles.chartContainer}>
                <PWView style={[styles.skeletonBlock, styles.skeletonChart]} />
                <PWView style={styles.skeletonPeriodRow}>
                    {Array.from({ length: PERIOD_BUTTON_COUNT }, (_, i) => (
                        <PWView
                            key={i}
                            style={[
                                styles.skeletonBlock,
                                styles.skeletonPeriodButton,
                            ]}
                        />
                    ))}
                </PWView>
            </PWView>
            <PWView style={styles.skeletonButtonRow}>
                {Array.from({ length: ACTION_BUTTON_COUNT }, (_, i) => (
                    <PWView
                        key={i}
                        style={[
                            styles.skeletonBlock,
                            styles.skeletonActionButton,
                        ]}
                    />
                ))}
            </PWView>
        </PWView>
    )
}
