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
