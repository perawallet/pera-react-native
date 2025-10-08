import { useNavigate } from 'react-router-dom'
import AccountOverview from '../../components/account/AccountOverview'
import AccountActions from '../../components/account/AccountActions'
import RecentTransactions from '../../components/account/RecentTransactions'
import { AccountScreenContainer, Header, BackButton } from './AccountScreen.styles'

const AccountScreen = (): React.ReactElement => {
  const navigate = useNavigate()

  return (
    <AccountScreenContainer>
      <Header>
        <BackButton onClick={() => navigate('/')}>← Back to Portfolio</BackButton>
        <h1>Account Details</h1>
        <p>View and manage your account information</p>
      </Header>

      <AccountOverview />

      <AccountActions />

      <RecentTransactions />
    </AccountScreenContainer>
  )
}

export default AccountScreen
