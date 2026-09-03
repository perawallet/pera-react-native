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

import { useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import { AccountAssetItemView } from '@modules/assets/components'
import type { PWTouchableOpacityProps } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { buildAccountBalanceFromRampToken } from './buildAccountBalanceFromRampToken'

export type OnrampAssetItemViewProps = {
    token: RampToken
    balance: Nullable<Decimal>
} & PWTouchableOpacityProps

export const OnrampAssetItemView = ({
    token,
    balance,
    ...rest
}: OnrampAssetItemViewProps) => {
    const accountBalance = useMemo(
        () => buildAccountBalanceFromRampToken(token, balance),
        [token, balance],
    )

    return (
        <AccountAssetItemView
            accountBalance={accountBalance}
            logoUrl={token.logo ?? undefined}
            showBalance={balance !== null}
            {...rest}
        />
    )
}
