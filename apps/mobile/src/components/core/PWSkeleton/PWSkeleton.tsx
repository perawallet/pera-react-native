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

import { Skeleton as RNESkeleton } from '@rneui/themed'
import type { StyleProp, ViewStyle } from 'react-native'
import { PWView } from '../PWView'
import { useStyles } from './styles'

export type PWSkeletonProps = {
    animation?: 'none' | 'pulse' | 'wave'
    height?: number
    width?: number
    style?: StyleProp<ViewStyle>
    circle?: boolean
    count?: number
    horizontal?: boolean
    gap?: number
}

export const PWSkeleton = ({
    animation = 'pulse',
    height,
    width,
    style,
    circle,
    count = 1,
    horizontal = false,
    gap,
    ...props
}: PWSkeletonProps) => {
    const styles = useStyles({ horizontal, gap })

    if (count <= 1) {
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

    return (
        <PWView style={styles.container}>
            {Array.from({ length: count }, (_, i) => (
                <RNESkeleton
                    key={i}
                    style={[styles.skeleton, style]}
                    animation={animation}
                    height={height}
                    width={width}
                    circle={circle}
                    {...props}
                />
            ))}
        </PWView>
    )
}
