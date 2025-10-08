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
