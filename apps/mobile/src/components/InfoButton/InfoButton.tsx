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

import { PWIcon, type PWIconSize, PWTouchableOpacity } from '@components/core'
import type { ReactNode, PropsWithChildren } from 'react'
import { useStyles } from './styles'
import { useInfoButton } from './useInfoButton'

export type InfoButtonProps = {
    variant?: 'primary' | 'secondary' | 'error'
    size?: PWIconSize
    title?: string
    /**
     * Optional content rendered inside the trigger touchable, before the
     * info icon. Use this to extend the tappable hit area to wrap adjacent
     * label/value content (e.g. an "Account type — Universal Wallet (i)"
     * cluster where the whole row should open the explainer sheet).
     */
    trigger?: ReactNode
    /**
     * Overrides the default `info-button` testID so callers rendering more
     * than one info affordance on a screen (e.g. a quantum-fee explainer
     * alongside a fee-warning icon) can target a specific one in tests.
     */
    testID?: string
} & PropsWithChildren

export const InfoButton = ({
    variant = 'secondary',
    size = 'sm',
    title,
    trigger,
    testID = 'info-button',
    children,
}: InfoButtonProps) => {
    const styles = useStyles()
    const { openInfo } = useInfoButton({ title, children })

    return (
        <PWTouchableOpacity
            style={trigger ? styles.triggerContainer : styles.iconContainer}
            onPress={openInfo}
            testID={testID}
        >
            {trigger}
            <PWIcon
                name='info'
                variant={variant}
                size={size}
            />
        </PWTouchableOpacity>
    )
}
