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

import { PWIcon, PWIconSize, PWTouchableOpacity } from '@components/core'
import { PropsWithChildren } from 'react'
import { useStyles } from './styles'
import { useInfoButton } from './useInfoButton'

export type InfoButtonProps = {
    variant?: 'primary' | 'secondary' | 'error'
    size?: PWIconSize
    title?: string
} & PropsWithChildren

export const InfoButton = ({
    variant = 'secondary',
    size = 'sm',
    title,
    children,
}: InfoButtonProps) => {
    const styles = useStyles()
    const { openInfo } = useInfoButton({ title, children })

    return (
        <PWTouchableOpacity
            style={styles.iconContainer}
            onPress={openInfo}
            testID='info-button'
        >
            <PWIcon
                name='info'
                variant={variant}
                size={size}
            />
        </PWTouchableOpacity>
    )
}
