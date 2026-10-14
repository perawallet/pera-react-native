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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AccountAssetItemView } from '@modules/assets'
import type { PWTouchableOpacityProps } from '@components/core'
import { buildAccountBalanceFromRampToken } from './buildAccountBalanceFromRampToken'

export type OnrampAssetItemViewProps = {
    token: RampToken
    balance: Nullable<Decimal>
    asset: Nullable<PeraAsset>
    scope: ChainScope
} & PWTouchableOpacityProps

export const OnrampAssetItemView = ({
    token,
    balance,
    asset,
    scope,
    ...rest
}: OnrampAssetItemViewProps) => {
    const accountBalance = useMemo(
        () => buildAccountBalanceFromRampToken(token, balance, scope, asset),
        [token, balance, scope, asset],
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
