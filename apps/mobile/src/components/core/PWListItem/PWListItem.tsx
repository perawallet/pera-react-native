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

import { PWIcon, type IconName } from '@components/core/PWIcon'
import {
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
} from '@components/core/PWTouchableOpacity'
import { PWText } from '@components/core/PWText'
import { useStyles } from './styles'
import { PWView } from '@components/core/PWView'
import { getTestProps } from '@utils/test-id-helper'

export type PWListItemProps = PWTouchableOpacityProps & {
    icon: IconName
    title: string
    value?: string
}

export const PWListItem = ({
    icon,
    title,
    value,
    style,
    testID,
    ...props
}: PWListItemProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={[styles.row, style]}
            {...getTestProps(testID)}
            {...props}
        >
            <PWView style={styles.labelContainer}>
                <PWIcon name={icon} />
                <PWText
                    style={styles.title}
                    numberOfLines={1}
                >
                    {title}
                </PWText>
            </PWView>
            <PWView style={styles.trailingContainer}>
                {value ? (
                    <PWText
                        style={styles.value}
                        numberOfLines={1}
                    >
                        {value}
                    </PWText>
                ) : null}
                <PWIcon
                    name='chevron-right'
                    variant='secondary'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
