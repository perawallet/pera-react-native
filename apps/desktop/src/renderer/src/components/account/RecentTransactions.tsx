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
  RecentTransactionsContainer,
  Title,
  TransactionList,
  TransactionItem,
  TransactionDetails,
  TransactionIcon,
  TransactionInfo,
  TransactionAmount
} from './RecentTransactions.styles'

const RecentTransactions = (): React.ReactElement => {
  return (
    <RecentTransactionsContainer>
      <Title>Recent Transactions</Title>
      <TransactionList>
        <TransactionItem>
          <TransactionDetails>
            <TransactionIcon className="received">📥</TransactionIcon>
            <TransactionInfo>
              <p>Received ALGO</p>
              <p>2 hours ago</p>
            </TransactionInfo>
          </TransactionDetails>
          <TransactionAmount>
            <p className="received">+50.00 ALGO</p>
            <p>≈ +$12.75</p>
          </TransactionAmount>
        </TransactionItem>

        <TransactionItem>
          <TransactionDetails>
            <TransactionIcon className="sent">📤</TransactionIcon>
            <TransactionInfo>
              <p>Sent USDC</p>
              <p>1 day ago</p>
            </TransactionInfo>
          </TransactionDetails>
          <TransactionAmount>
            <p className="sent">-25.00 USDC</p>
            <p>≈ -$25.00</p>
          </TransactionAmount>
        </TransactionItem>
      </TransactionList>
    </RecentTransactionsContainer>
  )
}

export default RecentTransactions
