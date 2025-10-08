import React, { useMemo } from 'react'
import {
  AccountOverviewContainer,
  AccountHeader,
  Avatar,
  AccountTitle,
  AccountSubtitle,
  AccountGrid,
  InfoCard,
  InfoCardTitle,
  Address,
  CopyButton,
  Balance
} from './AccountOverview.styles'
import {
  useAppStore,
  useAccountBalances,
  getAccountDisplayName,
  truncateAlgorandAddress
} from '@perawallet/core'

const AccountOverview = (): React.ReactElement => {
  const selectedAccount = useAppStore((state) => state.getSelectedAccount())
  const balances = useAccountBalances(selectedAccount ? [selectedAccount] : [])
  const balance = balances.length > 0 ? balances[0] : null

  const displayName = useMemo(
    () => (selectedAccount ? getAccountDisplayName(selectedAccount) : 'No Account'),
    [selectedAccount]
  )
  const displayAddress = useMemo(
    () => (selectedAccount ? truncateAlgorandAddress(selectedAccount.address) : ''),
    [selectedAccount]
  )

  const copyToClipboard = (): void => {
    if (selectedAccount) {
      navigator.clipboard.writeText(selectedAccount.address)
    }
  }

  return (
    <AccountOverviewContainer>
      <AccountHeader>
        <Avatar>👤</Avatar>
        <div>
          <AccountTitle>{displayName}</AccountTitle>
          <AccountSubtitle>Wallet account</AccountSubtitle>
        </div>
      </AccountHeader>

      <AccountGrid>
        <InfoCard>
          <InfoCardTitle>Account Address</InfoCardTitle>
          <Address>{displayAddress}</Address>
          <CopyButton onClick={copyToClipboard}>📋 Copy Address</CopyButton>
        </InfoCard>

        <InfoCard>
          <InfoCardTitle>Total Balance</InfoCardTitle>
          <Balance>
            {balance?.isFetched ? `₳${balance.algoAmount.toFixed(2)}` : 'Loading...'}
          </Balance>
          <AccountSubtitle>
            ≈ ${balance?.isFetched ? balance.usdAmount.toFixed(2) : '0.00'} USD
          </AccountSubtitle>
        </InfoCard>
      </AccountGrid>
    </AccountOverviewContainer>
  )
}

export default AccountOverview
