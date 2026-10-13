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
    PWIcon,
    PWView,
    type IconName,
    type PWIconVariant,
    type PWRoundIconProps,
} from '@components/core'
import { useStyles } from './styles'

export type TransactionIconProps = {
    name: IconName
    size?: 'sm' | 'md' | 'lg' | 'xl'
    variant?: PWIconVariant
} & Omit<PWRoundIconProps, 'icon' | 'size' | 'name' | 'variant'>

export const TransactionIcon = (props: TransactionIconProps) => {
    const { name, style, size = 'sm', variant = 'secondary', ...rest } = props
    const styles = useStyles({ size })

    return (
        <PWView
            style={[styles.container, style]}
            {...rest}
        >
            <PWIcon
                name={name}
                size={size}
                variant={variant === 'primary' ? 'white' : variant}
            />
        </PWView>
    )
}
