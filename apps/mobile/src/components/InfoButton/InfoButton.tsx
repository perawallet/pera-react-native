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

import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWIconSize,
    PWTouchableOpacity,
    PWView,
    PWText,
} from '@components/core'
import { useModalState } from '@hooks/useModalState'
import { PropsWithChildren } from 'react'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

/**
 * Props for the InfoButton component.
 */
export type InfoButtonProps = {
    /** Color variant for the info icon */
    variant?: 'primary' | 'secondary'
    /** Size of the info icon */
    size?: PWIconSize
    /** Optional title for the bottom sheet that opens */
    title?: string
} & PropsWithChildren

/**
 * An information icon button that opens a bottom sheet containing supplemental content.
 *
 * @example
 * <InfoButton title="Help">
 *   <PWText>Helpful information goes here.</PWText>
 * </InfoButton>
 */
export const InfoButton = ({
    variant = 'secondary',
    size = 'sm',
    title,
    children,
}: InfoButtonProps) => {
    const bottomSheetState = useModalState()
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <>
            <PWTouchableOpacity
                style={styles.iconContainer}
                onPress={bottomSheetState.open}
                testID='info-button'
            >
                <PWIcon
                    name='info'
                    variant={variant}
                    size={size}
                />
            </PWTouchableOpacity>
            <PWBottomSheet
                isVisible={bottomSheetState.isOpen}
                innerContainerStyle={styles.container}
            >
                {!!title && (
                    <PWText
                        variant='h3'
                        style={styles.title}
                    >
                        {title}
                    </PWText>
                )}
                <PWView style={styles.contentContainer}>{children}</PWView>
                <PWButton
                    variant='secondary'
                    title={t('common.close.label')}
                    onPress={bottomSheetState.close}
                    style={styles.closeButton}
                />
            </PWBottomSheet>
        </>
    )
}
