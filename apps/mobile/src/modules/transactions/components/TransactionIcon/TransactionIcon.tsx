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
    PWRoundIcon,
    type IconName,
    type PWRoundIconProps,
} from '@components/core'
import type { PeraTransactionType } from '@perawallet/wallet-core-blockchain'

export type TransactionIconType = PeraTransactionType | 'group'

export type TransactionIconProps = {
    type: TransactionIconType
    size?: 'sm' | 'md' | 'lg'
} & Omit<PWRoundIconProps, 'icon' | 'size' | 'name'>

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
        case 'asset-opt-in':
            return 'plus'
        case 'asset-opt-out':
            return 'cross'
        case 'asset-clawback':
            return 'undo'
        case 'group':
            return 'transactions/group'
        default:
            return 'transactions/payment'
    }
}

export const TransactionIcon = (props: TransactionIconProps) => {
    const { type, style, size = 'sm', ...rest } = props
    const iconSize = size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'xl'
    const name = getIconName(type)

    return (
        <PWRoundIcon
            icon={name}
            size={iconSize}
            style={style}
            {...rest}
        />
    )
}
