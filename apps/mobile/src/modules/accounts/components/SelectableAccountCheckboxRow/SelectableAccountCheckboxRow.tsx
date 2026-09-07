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

import type { ReactNode } from 'react'
import {
    PWChip,
    PWCheckbox,
    PWText,
    PWTouchableIcon,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useStyles } from './styles'

export type SelectableAccountCheckboxRowProps = {
    title: string
    titleCopyValue?: string
    subtitle?: string
    badge?: ReactNode
    leadingIcon?: ReactNode
    isSelected: boolean
    isImported?: boolean
    importedLabel?: string
    onToggle: () => void
    onInfoPress?: () => void
    testID?: string
    checkboxTestID?: string
    infoTestID?: string
}

export const SelectableAccountCheckboxRow = ({
    title,
    titleCopyValue,
    subtitle,
    badge,
    leadingIcon,
    isSelected,
    isImported = false,
    importedLabel,
    onToggle,
    onInfoPress,
    testID,
    checkboxTestID,
    infoTestID,
}: SelectableAccountCheckboxRowProps) => {
    const styles = useStyles({ isImported })

    const titleText = (
        <PWText
            variant='bodyLarge'
            weight={500}
            style={styles.title}
            numberOfLines={1}
        >
            {title}
        </PWText>
    )

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onToggle}
            disabled={isImported}
            testID={testID}
        >
            {leadingIcon}

            <PWView style={styles.textContainer}>
                <PWView style={styles.titleRow}>
                    {titleCopyValue ? (
                        <CopyableText copyValue={titleCopyValue}>
                            {titleText}
                        </CopyableText>
                    ) : (
                        titleText
                    )}
                    {badge}
                </PWView>
                {!!subtitle && (
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </PWText>
                )}
            </PWView>

            {!!onInfoPress && (
                <PWTouchableIcon
                    name='info'
                    size='sm'
                    variant='secondary'
                    onPress={onInfoPress}
                    testID={infoTestID}
                />
            )}

            {isImported ? (
                <PWChip
                    title={importedLabel ?? ''}
                    variant='secondary'
                />
            ) : (
                <PWCheckbox
                    checked={isSelected}
                    onPress={onToggle}
                    testID={checkboxTestID}
                />
            )}
        </PWTouchableOpacity>
    )
}
