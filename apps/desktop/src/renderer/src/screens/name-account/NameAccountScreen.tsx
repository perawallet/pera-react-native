import { useLocation, useNavigate } from 'react-router-dom'
import {
  useAllAccounts,
  getAccountDisplayName,
  useUpdateAccount,
  WalletAccount
} from '@perawallet/core'
import { useState } from 'react'
import {
  Container,
  Title,
  Subtitle,
  WalletInfo,
  Input,
  FinishButton
} from './NameAccountScreen.styles'

const NameAccountScreen = (): React.ReactElement => {
  const location = useLocation()
  const navigate = useNavigate()
  const accounts = useAllAccounts()
  const updateAccount = useUpdateAccount()

  const account = location.state?.account as WalletAccount
  const numWallets = accounts.length
  const initialWalletName = getAccountDisplayName(account)
  const [walletDisplay, setWalletDisplay] = useState<string>(initialWalletName)

  const saveName = (value: string): void => {
    if (account) {
      account.name = value
      updateAccount(account)
      setWalletDisplay(value)
    }
  }

  const goToHome = (): void => {
    navigate('/')
  }

  if (!account) {
    return <Container>Account not found</Container>
  }

  return (
    <Container>
      <Title>Name Your Account</Title>
      <Subtitle>Give your account a memorable name</Subtitle>
      <WalletInfo>Wallet #{numWallets + 1}</WalletInfo>
      <Input
        placeholder="Enter account name"
        value={walletDisplay}
        onChange={(e) => saveName(e.target.value)}
      />
      <FinishButton onClick={goToHome}>Finish Account Creation</FinishButton>
    </Container>
  )
}

export default NameAccountScreen
