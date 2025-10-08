import { useLocation, useNavigate } from 'react-router-dom'
import { useAllAccounts, getAccountDisplayName, useUpdateAccount, WalletAccount } from '@perawallet/core'
import { useState } from 'react'
import styled from 'styled-components'

const Container = styled.div`
  padding: var(--spacing-xl);
`

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-main);
`

const Subtitle = styled.p`
  color: var(--color-text-gray);
  margin-bottom: var(--spacing-lg);
`

const WalletInfo = styled.div`
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-gray);
`

const Input = styled.input`
  width: 100%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  font-size: 1rem;
  color: var(--color-text-main);
  background-color: var(--color-background);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

const FinishButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1rem;
  cursor: pointer;
`

const NameAccountScreen = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const accounts = useAllAccounts()
  const updateAccount = useUpdateAccount()

  const account = location.state?.account as WalletAccount
  const numWallets = accounts.length
  const initialWalletName = getAccountDisplayName(account)
  const [walletDisplay, setWalletDisplay] = useState<string>(initialWalletName)

  const saveName = (value: string) => {
    if (account) {
      account.name = value
      updateAccount(account)
      setWalletDisplay(value)
    }
  }

  const goToHome = () => {
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
      <FinishButton onClick={goToHome}>
        Finish Account Creation
      </FinishButton>
    </Container>
  );
};

export default NameAccountScreen;
