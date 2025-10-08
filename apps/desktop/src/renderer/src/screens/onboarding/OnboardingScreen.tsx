import { useNavigate } from 'react-router-dom'
import { useCreateAccount } from '@perawallet/core'
import { useState } from 'react'
import {
  Container,
  Title,
  Subtitle,
  ButtonContainer,
  CreateButton,
  ImportButton
} from './OnboardingScreen.styles'

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
