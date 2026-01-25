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

import { PWIcon, PWView, type IconName } from '@components/core'

import type { SvgProps } from 'react-native-svg'
import { useStyles } from './styles'
import type { PeraTransactionType } from '@perawallet/wallet-core-blockchain'

export type TransactionIconType =
    | PeraTransactionType
    | 'group'
    | 'opt-in'
    | 'opt-out'
    | 'clawback'
    | 'close'

export type TransactionIconProps = {
    type: TransactionIconType
    size?: 'small' | 'large'
} & SvgProps

const getIconName = (type: TransactionIconType): IconName => {
    switch (type) {
        case 'payment':
            return 'transactions/payment'
        case 'asset-transfer':
            return 'swap'
        case 'asset-config':
            return 'gear'
        case 'asset-freeze':
            return 'snowflake'
        case 'key-registration':
            return 'key'
        case 'app-call':
            return 'code'
        case 'opt-in':
            return 'plus'
        case 'opt-out':
            return 'cross'
        case 'clawback':
            return 'undo'
        case 'close':
            return 'cross'
        case 'group':
            return 'transactions/group'
        default:
            return 'transactions/payment'
    }
}

export const TransactionIcon = (props: TransactionIconProps) => {
    const { type, style, size = 'small', ...rest } = props
    const styles = useStyles(props)
    const iconSize = size === 'small' ? 'md' : 'lg'
    const name = getIconName(type)

    return (
        <PWView style={[styles.container, style]}>
            <PWIcon
                {...rest}
                name={name}
                size={iconSize}
            />
        </PWView>
    )
}
