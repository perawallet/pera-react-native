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

import { PWSwitch, type PWTextProps, PWView } from '@components/core'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@components/AccountDisplay'
import { useMemo } from 'react'
import type { AccountIconProps } from '@components/AccountIcon'
import { useStyles } from '../styles'

const iconProps = {
    size: 'lg',
} as AccountIconProps

export type AccountNotificationItemProps = {
    account: WalletAccount
    isEnabled: boolean
    isPending: boolean
    onToggle: (enabled: boolean) => void
}

export const AccountNotificationItem = ({
    account,
    isEnabled,
    isPending,
    onToggle,
}: AccountNotificationItemProps) => {
    const styles = useStyles()

    const textProps = useMemo<PWTextProps>(
        () => ({
            style: styles.mainText,
            variant: 'h4',
        }),
        [styles],
    )

    return (
        <PWView style={styles.accountItem}>
            <PWView style={styles.accountInfo}>
                <AccountDisplay
                    account={account}
                    showChevron={false}
                    iconProps={iconProps}
                    textProps={textProps}
                    style={styles.accountDisplay}
                />
            </PWView>
            <PWView style={styles.switchContainer}>
                <PWSwitch
                    value={isEnabled}
                    onValueChange={onToggle}
                    disabled={isPending}
                />
            </PWView>
        </PWView>
    )
}
