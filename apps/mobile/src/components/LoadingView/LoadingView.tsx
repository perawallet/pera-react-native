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

import { ActivityIndicator } from 'react-native'
import { PWSkeleton, PWView } from '@components/core'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'

/**
 * Props for the LoadingView component.
 */
export type LoadingViewProps = {
    /** Type of loading indicator to show */
    variant: 'circle' | 'skeleton'
    /** Size of the spinner or height of the skeletons */
    size?: 'sm' | 'lg'
    /** Number of skeleton lines to show (only for variant='skeleton') */
    count?: number
}

/**
 * A reusable loading utility component that can show an activity spinner OR skeleton placeholders.
 *
 * @example
 * <LoadingView variant="circle" size="lg" />
 * <LoadingView variant="skeleton" count={3} />
 */
export const LoadingView = ({
    variant,
    size = 'sm',
    count = 1,
}: LoadingViewProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    if (variant === 'circle') {
        return (
            <PWView style={styles.container}>
                <ActivityIndicator
                    size={size === 'sm' ? 'small' : 'large'}
                    color={theme.colors.linkPrimary}
                />
            </PWView>
        )
    }

    if (variant === 'skeleton') {
        return (
            <PWView style={styles.container}>
                {Array.from({ length: count }, (_, i) => (
                    <PWSkeleton
                        key={i}
                        style={styles.skeleton}
                        height={
                            size === 'sm'
                                ? theme.spacing['3xl']
                                : theme.spacing['5xl']
                        }
                    />
                ))}
            </PWView>
        )
    }
}
