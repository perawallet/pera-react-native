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

import type { ReactNode } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { AccountDisplay } from '@components/AccountDisplay'
import { AccountWithBalance } from '@components/AccountWithBalance'
import { useStyles } from './styles'

type AccountResultRowProps = {
    account: WalletAccount
    showBalance: boolean
    chainId: ChainId
    /** Shown after the address; the balance row badges itself. */
    badges?: ReactNode
}

export const AccountResultRow = ({
    account,
    showBalance,
    chainId,
    badges,
}: AccountResultRowProps) => {
    const styles = useStyles()

    if (!showBalance) {
        return (
            <AccountDisplay
                account={account}
                chainId={chainId}
                badges={badges}
                showChevron={false}
                style={styles.accountDisplay}
            />
        )
    }

    return (
        <AccountWithBalance
            account={account}
            chainId={chainId}
        />
    )
}
