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

import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native'
import { PWSkeleton } from '@components/core/PWSkeleton'
import { PWView } from '@components/core/PWView'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import type { PropsWithChildren, ReactNode } from 'react'

export type LoadingViewProps = {
    variant: 'circle' | 'skeleton'
    size?: 'sm' | 'lg'
    count?: number
    isLoading?: boolean
    renderSkeleton?: (index: number) => ReactNode
    style?: StyleProp<ViewStyle>
} & PropsWithChildren

export const LoadingView = ({
    variant,
    size = 'sm',
    count = 1,
    isLoading = true,
    renderSkeleton,
    style,
    children,
}: LoadingViewProps) => {
    const { theme } = useTheme()
    const defaultStyles = useStyles()

    if (!isLoading) {
        return children
    }

    if (variant === 'circle') {
        return (
            <PWView style={[defaultStyles.container, style]}>
                <ActivityIndicator
                    size={size === 'sm' ? 'small' : 'large'}
                    color={theme.colors.linkPrimary}
                />
            </PWView>
        )
    }

    if (variant === 'skeleton') {
        return (
            <PWView style={[defaultStyles.container, style]}>
                {Array.from({ length: count }, (_, i) =>
                    renderSkeleton ? (
                        renderSkeleton(i)
                    ) : (
                        <PWSkeleton
                            key={i}
                            style={defaultStyles.skeleton}
                            height={
                                size === 'sm'
                                    ? theme.spacing['3xl']
                                    : theme.spacing['5xl']
                            }
                        />
                    ),
                )}
            </PWView>
        )
    }
}
