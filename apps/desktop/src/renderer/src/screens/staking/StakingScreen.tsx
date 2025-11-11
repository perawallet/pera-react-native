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

import React from 'react'
import { StakingContainer, Header, Grid, Card } from './StakingScreen.styles'

const StakingScreen = (): React.ReactElement => {
  return (
    <StakingContainer>
      <Header>
        <h1>Staking</h1>
        <p>Earn rewards by staking your assets</p>
      </Header>

      <Grid>
        <Card>
          <h3>Available Pools</h3>
          <p>View and participate in staking pools</p>
        </Card>
        <Card>
          <h3>My Stakes</h3>
          <p>Manage your active stakes</p>
        </Card>
      </Grid>
    </StakingContainer>
  )
}

export default StakingScreen
