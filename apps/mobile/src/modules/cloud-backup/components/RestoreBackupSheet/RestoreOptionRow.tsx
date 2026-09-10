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

import {
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    type IconName,
} from '@components/core'
import { getTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'

type RestoreOptionRowProps = {
    icon: IconName
    label: string
    onPress: () => void
    testID: string
}

export const RestoreOptionRow = ({
    icon,
    label,
    onPress,
    testID,
}: RestoreOptionRowProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.optionRow}
            onPress={onPress}
            {...getTestProps(testID)}
        >
            <PWIcon name={icon} />
            <PWView style={styles.optionLabel}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                >
                    {label}
                </PWText>
            </PWView>
        </PWTouchableOpacity>
    )
}
