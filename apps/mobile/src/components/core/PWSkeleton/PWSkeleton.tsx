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

import { Skeleton as RNESkeleton } from '@rneui/themed'
import { useStyles } from './styles'
import { StyleProp, ViewStyle } from 'react-native'

/**
 * Props for the PWSkeleton component.
 */
export type PWSkeletonProps = {
    /** Animation variant for the skeleton */
    animation?: 'none' | 'pulse' | 'wave'
    /** Explicit height for the skeleton */
    height?: number
    /** Explicit width for the skeleton */
    width?: number
    /** Optional style overrides */
    style?: StyleProp<ViewStyle>
    /** Whether to render the skeleton as a circle */
    circle?: boolean
}

/**
 * A themed skeleton loader component used as a placeholder while content is loading.
 * Wraps RNE Skeleton with project styling.
 *
 * @example
 * <PWSkeleton width={200} height={20} />
 */
export const PWSkeleton = ({
    animation = 'pulse',
    height,
    width,
    style,
    circle,
    ...props
}: PWSkeletonProps) => {
    const styles = useStyles()

    return (
        <RNESkeleton
            style={[styles.skeleton, style]}
            animation={animation}
            height={height}
            width={width}
            circle={circle}
            {...props}
        />
    )
}
