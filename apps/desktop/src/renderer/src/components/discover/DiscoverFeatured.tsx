import styled from 'styled-components'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'

const FeaturedContainer = styled.div`
  margin-top: 2rem;
`

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1.5rem;
`

const FeaturedCard = styled(Card)`
  background: linear-gradient(to right, #6b46fe, #27272a);
  color: #f9fafb;
`

const StyledCardContent = styled(CardContent)`
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const FeaturedDetails = styled.div`
  h3 {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  p {
    font-size: 1.125rem;
    opacity: 0.9;
    margin-bottom: 1rem;
  }
`

const FeaturedIcon = styled.div`
  font-size: 3.75rem;
`

const DiscoverFeatured = (): React.ReactElement => {
  return (
    <FeaturedContainer>
      <Title>Featured This Week</Title>
      <FeaturedCard>
        <StyledCardContent>
          <FeaturedDetails>
            <h3>New DeFi Protocol Launch</h3>
            <p>Experience the next generation of decentralized finance</p>
            <Button variant="secondary">Learn More</Button>
          </FeaturedDetails>
          <FeaturedIcon>🚀</FeaturedIcon>
        </StyledCardContent>
      </FeaturedCard>
    </FeaturedContainer>
  )
}

export default DiscoverFeatured
