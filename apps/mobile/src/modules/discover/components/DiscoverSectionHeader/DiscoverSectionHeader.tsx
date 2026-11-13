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
    PWButton,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    type IconName,
} from '@components/core'
import { useStyles } from './styles'

export type DiscoverSectionHeaderProps = {
    title: string
    icon?: IconName
    onPress?: () => void
    action?: { label: string; onPress: () => void; testID?: string }
    testID?: string
}

export const DiscoverSectionHeader = ({
    title,
    icon,
    onPress,
    action,
    testID,
}: DiscoverSectionHeaderProps) => {
    const styles = useStyles()

    const heading = (
        <>
            {icon ? (
                <PWIcon
                    name={icon}
                    size='sm'
                />
            ) : null}
            <PWText
                variant='h3'
                numberOfLines={1}
                style={styles.title}
            >
                {title}
            </PWText>
            {onPress ? (
                <PWIcon
                    name='chevron-right'
                    size='sm'
                    variant='secondary'
                />
            ) : null}
        </>
    )

    return (
        <PWView style={styles.header}>
            {onPress ? (
                <PWTouchableOpacity
                    style={styles.heading}
                    onPress={onPress}
                    testID={testID}
                >
                    {heading}
                </PWTouchableOpacity>
            ) : (
                <PWView
                    style={styles.heading}
                    testID={testID}
                >
                    {heading}
                </PWView>
            )}
            {action ? (
                <PWButton
                    variant='link'
                    paddingStyle='none'
                    title={action.label}
                    onPress={action.onPress}
                    testID={action.testID}
                />
            ) : null}
        </PWView>
    )
}
