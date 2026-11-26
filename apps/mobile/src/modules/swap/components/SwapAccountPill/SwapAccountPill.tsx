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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@components/AccountDisplay'
import { PWView } from '@components/core'
import { useStyles } from './styles'

export type SwapAccountPillProps = {
    account: WalletAccount
}

// Display-only: the account changes through the pay asset picker or a recent pair chip, never here.
export const SwapAccountPill = ({ account }: SwapAccountPillProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.pill}
            testID='swap_account_pill'
        >
            <AccountDisplay
                account={account}
                iconProps={{ size: 'sm' }}
                textProps={{ variant: 'body', style: styles.name }}
                showChevron={false}
                shouldShowSecondaryLabel={false}
                noBorder
                style={styles.display}
            />
        </PWView>
    )
}
