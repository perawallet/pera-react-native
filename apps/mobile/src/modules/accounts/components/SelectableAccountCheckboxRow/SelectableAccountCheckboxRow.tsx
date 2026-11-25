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
    details?: ReactNode
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
    details,
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

    const content = (
        <>
            {leadingIcon}

            <PWView style={styles.textContainer}>
                <PWView style={styles.titleRow}>
                    {titleCopyValue ? (
                        // CopyableText claims the tap even with only a long
                        // press, so without the toggle a tap on the title is lost.
                        <CopyableText
                            copyValue={titleCopyValue}
                            onPress={isImported ? undefined : onToggle}
                        >
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
                {details}
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
        </>
    )

    if (isImported) {
        return (
            <PWTouchableOpacity
                style={styles.container}
                disabled
                testID={testID}
            >
                {content}
                <PWChip
                    title={importedLabel ?? ''}
                    variant='secondary'
                />
            </PWTouchableOpacity>
        )
    }

    return (
        <PWCheckbox
            label={content}
            boxPosition='trailing'
            isChecked={isSelected}
            onPress={onToggle}
            style={styles.container}
            testID={testID}
            boxTestID={checkboxTestID}
        />
    )
}
