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

import { memo, useCallback } from 'react'
import { PWTouchableOpacity } from '@components/core'
import { AccountWithBalance } from '@modules/accounts/components/AccountWithBalance'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

export type RekeyTargetRowProps = {
    account: WalletAccount
    onSelect: (account: WalletAccount) => void
}

const RekeyTargetRowComponent = ({
    account,
    onSelect,
}: RekeyTargetRowProps) => {
    const handlePress = useCallback(
        () => onSelect(account),
        [account, onSelect],
    )

    return (
        <PWTouchableOpacity
            onPress={handlePress}
            testID={`rekey-target-row-${account.address}`}
        >
            <AccountWithBalance account={account} />
        </PWTouchableOpacity>
    )
}

export const RekeyTargetRow = memo(RekeyTargetRowComponent)
