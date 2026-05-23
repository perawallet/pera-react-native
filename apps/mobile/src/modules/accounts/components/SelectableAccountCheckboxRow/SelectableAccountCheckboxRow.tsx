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

import { type ReactNode } from 'react'
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
    /** When set, the title is wrapped in a CopyableText for the given value. */
    titleCopyValue?: string
    subtitle?: string
    /** Inline badge rendered next to the title (e.g. a "rekeyed" chip). */
    badge?: ReactNode
    /** Leading visual rendered before the text (e.g. an account icon). */
    leadingIcon?: ReactNode
    isSelected: boolean
    isImported?: boolean
    /** Chip label shown in place of the checkbox when the account is imported. */
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
            variant='body'
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
                        variant='caption'
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
