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
  BalanceCard,
  BalanceContainer,
  BalanceAmount,
  PrimaryBalance,
  SecondaryBalance
} from './PortfolioBalance.styles'
import Decimal from 'decimal.js'
import { AccountWealthHistoryItem, useAccountBalances, useAppStore } from '@perawallet/core'
import { useState } from 'react'

const PortfolioBalance = (): React.ReactElement => {
  const accounts = useAppStore((state) => state.accounts)
  const data = useAccountBalances(accounts)
  const [chartData] = useState<AccountWealthHistoryItem | null>(null)

  const loading = data.some((d) => !d.isFetched)
  const algoAmount = data.reduce((acc, cur) => acc.plus(cur.algoAmount), Decimal(0))
  const usdAmount = data.reduce((acc, cur) => acc.plus(cur.usdAmount), Decimal(0))
  const displayAlgoAmount = chartData ? Decimal(chartData.algo_value) : algoAmount
  const displayUsdAmount = chartData ? Decimal(chartData.value_in_currency ?? '0') : usdAmount

  return (
    <BalanceCard>
      <BalanceContainer>
        <BalanceAmount>
          <PrimaryBalance>{loading ? '...' : `₳${displayAlgoAmount.toFixed(2)}`}</PrimaryBalance>
          <SecondaryBalance>
            {loading ? '...' : `≈ $${displayUsdAmount.toFixed(2)} USD`}
          </SecondaryBalance>
        </BalanceAmount>
      </BalanceContainer>
    </BalanceCard>
  )
}

export default PortfolioBalance
