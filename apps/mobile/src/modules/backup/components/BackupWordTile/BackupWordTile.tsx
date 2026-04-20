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

import { PWText, PWTouchableOpacity } from '@components/core'
import { useStyles } from './styles'

export type BackupWordTileProps = {
    word: string
    onPress: () => void
    hasError?: boolean
    disabled?: boolean
    testID?: string
}

export const BackupWordTile = ({
    word,
    onPress,
    hasError = false,
    disabled = false,
    testID,
}: BackupWordTileProps) => {
    const styles = useStyles({ hasError, disabled })
    return (
        <PWTouchableOpacity
            onPress={onPress}
            disabled={disabled}
            testID={testID}
            accessibilityState={{ disabled }}
            // react-native AccessibilityState has no `invalid` key. Surface the
            // error state via aria-invalid so assistive tech + web-based tests
            // can observe it.
            // @ts-expect-error — aria-invalid is a valid web attr, not typed on RN
            aria-invalid={hasError ? true : undefined}
        >
            <PWText style={styles.container}>{word}</PWText>
        </PWTouchableOpacity>
    )
}
