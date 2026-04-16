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

import { PropsWithChildren, ReactNode } from 'react'
import { PWBottomSheet } from '@components/core/PWBottomSheet'
import { PWButton } from '@components/core/PWButton'
import { PWIcon, PWIconSize, PWIconVariant } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { usePWTooltip } from './usePWTooltip'

export type PWTooltipVariant = 'primary' | 'secondary' | 'error'

export type PWTooltipProps = {
    /**
     * Stable id used to persist "seen" state for first-run auto-open tooltips.
     * When provided together with `autoOpenFirstRun`, the tooltip opens once
     * on mount and is remembered across app restarts.
     */
    id?: string
    title?: string
    variant?: PWTooltipVariant
    iconSize?: PWIconSize
    iconVariant?: PWIconVariant
    confirmLabel?: string
    /**
     * When true and `id` is provided, opens the sheet automatically on mount
     * if the user has not acknowledged this tooltip before.
     */
    autoOpenFirstRun?: boolean
    /**
     * Renders a custom trigger instead of the default info icon. Receives an
     * `onPress` callback that opens the tooltip sheet.
     */
    renderTrigger?: (props: { onPress: () => void }) => ReactNode
    testID?: string
} & PropsWithChildren

export const PWTooltip = ({
    id,
    title,
    variant = 'secondary',
    iconSize = 'sm',
    iconVariant,
    confirmLabel,
    autoOpenFirstRun = false,
    renderTrigger,
    testID = 'pw-tooltip',
    children,
}: PWTooltipProps) => {
    const styles = useStyles()
    const {
        isOpen,
        openTooltip,
        handleClose,
        resolvedIconVariant,
        resolvedConfirmLabel,
    } = usePWTooltip({
        id,
        variant,
        iconVariant,
        confirmLabel,
        autoOpenFirstRun,
    })

    return (
        <>
            {renderTrigger ? (
                renderTrigger({ onPress: openTooltip })
            ) : (
                <PWTouchableOpacity
                    style={styles.iconContainer}
                    onPress={openTooltip}
                    testID={`${testID}-trigger`}
                >
                    <PWIcon
                        name='info'
                        variant={resolvedIconVariant}
                        size={iconSize}
                    />
                </PWTouchableOpacity>
            )}
            <PWBottomSheet
                isVisible={isOpen}
                onBackdropPress={handleClose}
                innerContainerStyle={styles.container}
                testID={`${testID}-sheet`}
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
                    title={resolvedConfirmLabel}
                    onPress={handleClose}
                    testID={`${testID}-confirm`}
                />
            </PWBottomSheet>
        </>
    )
}
