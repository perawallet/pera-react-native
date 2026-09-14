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

import { useCallback } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWCheckbox, PWTouchableOpacity } from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useStyles } from '@modules/walletconnect/components/connection-approval/styles'

export type ConnectionApprovalAccountRowProps = {
    account: WalletAccount
    isSelected: boolean
    onPress: (address: string) => void
}

export const ConnectionApprovalAccountRow = ({
    account,
    isSelected,
    onPress,
}: ConnectionApprovalAccountRowProps) => {
    const styles = useStyles()
    const handlePress = useCallback(
        () => onPress(account.address),
        [onPress, account.address],
    )

    return (
        <PWTouchableOpacity
            style={styles.accountItem}
            onPress={handlePress}
            testID={`wc_account_row_${account.address}`}
        >
            <AccountDisplay
                account={account}
                showChevron={false}
            />
            <PWCheckbox
                onPress={handlePress}
                checked={isSelected}
            />
        </PWTouchableOpacity>
    )
}
