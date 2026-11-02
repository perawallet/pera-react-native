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
import { useTheme } from '@rneui/themed'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    getIconPixelSize,
    PWCheckbox,
    PWTouchableOpacity,
} from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { useStyles } from '@components/ConnectionApproval/styles'
import { ChainIcon } from '@modules/chain-ui/icon'

export type ConnectionApprovalAccountRowProps = {
    account: WalletAccount
    /** The chain whose address and badge the row shows. */
    chainId: ChainId
    isSelected: boolean
    onPress: (accountId: string) => void
}

export const ConnectionApprovalAccountRow = ({
    account,
    chainId,
    isSelected,
    onPress,
}: ConnectionApprovalAccountRowProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const handlePress = useCallback(
        () => onPress(account.id),
        [onPress, account.id],
    )

    return (
        <PWTouchableOpacity
            style={styles.accountItem}
            onPress={handlePress}
            testID={`wc_account_row_${account.id}`}
        >
            <AccountDisplay
                account={account}
                chainId={chainId}
                avatarBadge={
                    <ChainIcon
                        chainId={chainId}
                        size={getIconPixelSize(theme, 'xs')}
                    />
                }
                showChevron={false}
            />
            <PWCheckbox
                onPress={handlePress}
                checked={isSelected}
            />
        </PWTouchableOpacity>
    )
}
