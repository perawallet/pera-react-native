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
