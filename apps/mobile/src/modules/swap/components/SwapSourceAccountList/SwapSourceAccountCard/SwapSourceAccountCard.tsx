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
import type {
    AccountChainAssetBalance,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { PWDivider, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { AccountAssetItemView } from '@modules/assets'
import { useStyles } from './styles'

export type SwapSourceAccountCardProps = {
    account: WalletAccount
    holding: AccountChainAssetBalance
    networkLabel: string
    onSelect: (holding: AccountChainAssetBalance) => void
}

export const SwapSourceAccountCard = ({
    account,
    holding,
    networkLabel,
    onSelect,
}: SwapSourceAccountCardProps) => {
    const styles = useStyles()
    const handlePress = useCallback(
        () => onSelect(holding),
        [onSelect, holding],
    )

    return (
        <PWTouchableOpacity
            style={styles.card}
            onPress={handlePress}
            testID={`swap_source_account_${account.id}`}
        >
            <AccountDisplay
                account={account}
                chainId={holding.scope.chainId}
                shouldShowSecondaryLabel={false}
                noBorder
            />
            <PWDivider />
            <PWView pointerEvents='none'>
                <AccountAssetItemView
                    accountBalance={holding}
                    scope={holding.scope}
                    showChainBadge
                    subtitle={
                        <PWText
                            style={styles.networkLabel}
                            numberOfLines={1}
                        >
                            {networkLabel}
                        </PWText>
                    }
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
