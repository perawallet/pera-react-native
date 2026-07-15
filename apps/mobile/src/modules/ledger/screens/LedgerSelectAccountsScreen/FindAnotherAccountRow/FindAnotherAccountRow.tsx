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

import { ActivityIndicator } from 'react-native'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type FindAnotherAccountRowProps = {
    onPress: () => void
    isLoading: boolean
    label: string
    testID?: string
}

export const FindAnotherAccountRow = ({
    onPress,
    isLoading,
    label,
    testID,
}: FindAnotherAccountRowProps) => {
    const styles = useStyles({ isLoading })

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            disabled={isLoading}
            testID={testID}
        >
            <PWView style={styles.iconContainer}>
                {isLoading ? (
                    <ActivityIndicator
                        testID={testID ? `${testID}-spinner` : undefined}
                        size='small'
                    />
                ) : (
                    <PWIcon
                        name='plus'
                        variant='positive'
                        size='md'
                    />
                )}
            </PWView>
            <PWText
                variant='link'
                style={styles.label}
            >
                {label}
            </PWText>
        </PWTouchableOpacity>
    )
}
