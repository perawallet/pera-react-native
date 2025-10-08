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
