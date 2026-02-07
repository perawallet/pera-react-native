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
    PWIcon,
    PWView,
    type IconName,
    type PWRoundIconProps,
} from '@components/core'
import type { PeraTransactionType } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'

export type TransactionIconType = PeraTransactionType | 'group'

export type TransactionIconProps = {
    type: TransactionIconType
    size?: 'sm' | 'md' | 'lg'
} & Omit<PWRoundIconProps, 'icon' | 'size' | 'name'>

const iconNameMap: Record<TransactionIconType, IconName> = {
    payment: 'transactions/payment',
    'asset-transfer': 'transactions/swap',
    'asset-config': 'transactions/asset-config',
    'asset-freeze': 'transactions/asset-freeze',
    'key-registration': 'transactions/key-registration',
    'app-call': 'transactions/application-call',
    'asset-opt-in': 'transactions/opt-in',
    'asset-opt-out': 'transactions/opt-out',
    group: 'transactions/group',
    'asset-clawback': 'transactions/generic',
    'state-proof': 'transactions/generic',
    heartbeat: 'transactions/generic',
    unknown: 'transactions/generic',
}

export const TransactionIcon = (props: TransactionIconProps) => {
    const { type, style, size = 'sm', variant = 'secondary', ...rest } = props
    const styles = useStyles({ size })
    const name = iconNameMap[type] ?? 'transactions/generic'

    return (
        <PWView
            style={[styles.container, style]}
            {...rest}
        >
            <PWIcon
                name={name}
                size={size === 'md' ? 'md' : size === 'sm' ? 'sm' : 'lg'}
                variant={variant === 'primary' ? 'white' : variant}
            />
        </PWView>
    )
}
