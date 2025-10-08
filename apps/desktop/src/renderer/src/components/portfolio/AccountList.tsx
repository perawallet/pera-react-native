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
