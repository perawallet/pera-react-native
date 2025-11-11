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
