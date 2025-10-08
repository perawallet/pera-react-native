import { useNavigate } from 'react-router-dom'
import { useCreateAccount } from '@perawallet/core'
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
`

const ButtonContainer = styled.div`
  margin-top: var(--spacing-xl);
  text-align: center;
`

const CreateButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1.125rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const ImportButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-grey4);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1.125rem;
  cursor: pointer;
  margin-left: var(--spacing-lg);
`

const OnboardingScreen = (): React.ReactElement => {
  const navigate = useNavigate()
  const createAccount = useCreateAccount()
  const [processing, setProcessing] = useState(false)

  const doCreate = async (): Promise<void> => {
    try {
      const account = await createAccount({ account: 0, keyIndex: 0 })
      navigate('/name-account', { state: { account } })
    } finally {
      setProcessing(false)
    }
  }

  const createAccountHandler = async (): Promise<void> => {
    setProcessing(true)
    doCreate()
  }

  const importAccount = (): void => {
    navigate('/import-account')
  }

  return (
    <Container>
      <Title>Welcome to Pera Wallet</Title>
      <Subtitle>Get started with your crypto journey</Subtitle>
      <ButtonContainer>
        <CreateButton onClick={createAccountHandler} disabled={processing}>
          {processing ? 'Creating...' : 'Create New Account'}
        </CreateButton>
        <ImportButton onClick={importAccount}>Import Existing Account</ImportButton>
      </ButtonContainer>
    </Container>
  )
}

export default OnboardingScreen
