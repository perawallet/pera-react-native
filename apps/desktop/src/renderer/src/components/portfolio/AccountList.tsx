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

import { Link } from 'react-router-dom'
import {
  AccountListContainer,
  Title,
  AccountGrid,
  AccountCard,
  AccountCardContent,
  AccountInfo,
  AccountDetails,
  AccountBalance
} from './AccountList.styles'
import {
  useAllAccounts,
  useAccountBalances,
  WalletAccount,
  getAccountDisplayName,
  truncateAlgorandAddress
} from '@perawallet/core'

const AccountList = (): React.ReactElement => {
  const accounts = useAllAccounts()
  const balances = useAccountBalances(accounts)

  return (
    <AccountListContainer>
      <Title>Accounts</Title>
      <AccountGrid>
        {accounts.map((account: WalletAccount, index: number) => {
          const balance = balances[index]
          const displayName = getAccountDisplayName(account)
          const displayAddress = truncateAlgorandAddress(account.address)

          return (
            <Link key={account.address} to="/account">
              <AccountCard>
                <AccountCardContent>
                  <AccountInfo>
                    <AccountDetails>
                      <p>{displayName}</p>
                      <p>{displayAddress}</p>
                    </AccountDetails>
                    <AccountBalance>
                      <p>
                        {balance?.isFetched ? `₳${balance.algoAmount.toFixed(2)}` : 'Loading...'}
                      </p>
                      <p>≈ ${balance?.isFetched ? balance.usdAmount.toFixed(2) : '0.00'}</p>
                    </AccountBalance>
                  </AccountInfo>
                </AccountCardContent>
              </AccountCard>
            </Link>
          )
        })}
      </AccountGrid>
    </AccountListContainer>
  )
}

export default AccountList
