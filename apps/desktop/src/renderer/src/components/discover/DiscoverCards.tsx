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

import styled from 'styled-components'
import { Card, CardContent, CardTitle } from '../../components/ui/card'

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
`

const StyledCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    box-shadow:
      0 10px 15px -3px rgb(0 0 0 / 0.1),
      0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  .icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    transition: transform 0.2s;
  }

  &:hover .icon {
    transform: scale(1.1);
  }
`

const StyledCardContent = styled(CardContent)`
  padding: 2rem;
`

const StyledCardTitle = styled(CardTitle)`
  margin-bottom: 0.75rem;
`

const CardDescription = styled.p`
  color: #6b7280;
  line-height: 1.5rem;
`

const DiscoverCards = (): React.ReactElement => {
  const cardsData = [
    {
      icon: '📈',
      title: 'Trending Assets',
      description: 'Explore the most popular cryptocurrencies and track their performance'
    },
    {
      icon: '🏊',
      title: 'Top Pools',
      description: 'Find the best liquidity pools for trading with optimal yields'
    },
    {
      icon: '📰',
      title: 'News',
      description: 'Stay updated with the latest cryptocurrency news and market insights'
    },
    {
      icon: '🚀',
      title: 'Projects',
      description: 'Discover innovative blockchain projects and emerging opportunities'
    }
  ]

  return (
    <GridContainer>
      {cardsData.map((card, index) => (
        <StyledCard key={index}>
          <StyledCardContent>
            <div className="icon">{card.icon}</div>
            <StyledCardTitle>{card.title}</StyledCardTitle>
            <CardDescription>{card.description}</CardDescription>
          </StyledCardContent>
        </StyledCard>
      ))}
    </GridContainer>
  )
}

export default DiscoverCards
