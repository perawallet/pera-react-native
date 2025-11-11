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

import PortfolioBalance from '../../components/portfolio/PortfolioBalance'
import PortfolioActions from '../../components/portfolio/PortfolioActions'
import AccountList from '../../components/portfolio/AccountList'
import { PortfolioContainer, Header } from './PortfolioScreen.styles'
import PortfolioChart from '@renderer/components/portfolio/PortfolioChart'
import React from 'react'

const PortfolioScreen = (): React.ReactElement => {
  return (
    <PortfolioContainer>
      <Header>
        <h1>Portfolio</h1>
        <p>View your portfolio value and accounts</p>
      </Header>

      <PortfolioBalance />

      <PortfolioChart />

      <PortfolioActions />

      <AccountList />
    </PortfolioContainer>
  )
}

export default PortfolioScreen
