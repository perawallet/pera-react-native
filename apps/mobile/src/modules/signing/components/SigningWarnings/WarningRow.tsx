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

import { useTheme } from '@rneui/themed'
import {
    PWDivider,
    PWRoundIcon,
    PWText,
    PWView,
    type IconName,
} from '@components/core'
import { useStyles } from './styles'

export type WarningRowProps = {
    icon: IconName
    message: string
    emphasis?: string
    caption?: string
    showDivider: boolean
    testID?: string
}

export const WarningRow = ({
    icon,
    message,
    emphasis,
    caption,
    showDivider,
    testID,
}: WarningRowProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <>
            {showDivider && (
                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />
            )}
            <PWView
                style={styles.warningSection}
                testID={testID}
            >
                <PWView style={styles.warningSectionIconContainer}>
                    <PWRoundIcon
                        icon={icon}
                        size='md'
                        variant='secondary'
                    />
                    <PWView style={styles.warningMessageContainer}>
                        <PWText style={styles.warningMessage}>{message}</PWText>
                        {!!emphasis && <PWText variant='h4'>{emphasis}</PWText>}
                        {!!caption && (
                            <PWText
                                variant='caption'
                                style={styles.senderText}
                            >
                                {caption}
                            </PWText>
                        )}
                    </PWView>
                </PWView>
            </PWView>
        </>
    )
}
