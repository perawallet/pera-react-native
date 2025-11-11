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

import {
  AssetDetailsContainer,
  Header,
  Description,
  ContentWrapper,
  AssetCard,
  AssetTitle,
  AssetSubtitle,
  AssetPrice,
  InfoGrid,
  InfoCard,
  InfoCardTitle,
  InfoCardValue
} from './AssetDetailsScreen.styles'

const AssetDetailsScreen = (): React.ReactElement => {
  return (
    <AssetDetailsContainer>
      <Header>Asset Details</Header>
      <Description>Detailed information about the selected asset</Description>

      <ContentWrapper>
        <AssetCard>
          <AssetTitle>ALGO</AssetTitle>
          <AssetSubtitle>Algorand</AssetSubtitle>
          <AssetPrice>$0.25</AssetPrice>
        </AssetCard>

        <InfoGrid>
          <InfoCard>
            <InfoCardTitle>Market Cap</InfoCardTitle>
            <InfoCardValue>$1.2B</InfoCardValue>
          </InfoCard>
          <InfoCard>
            <InfoCardTitle>24h Volume</InfoCardTitle>
            <InfoCardValue>$50M</InfoCardValue>
          </InfoCard>
          <InfoCard>
            <InfoCardTitle>Circulating Supply</InfoCardTitle>
            <InfoCardValue>8.1B ALGO</InfoCardValue>
          </InfoCard>
          <InfoCard>
            <InfoCardTitle>Your Balance</InfoCardTitle>
            <InfoCardValue>100.50 ALGO</InfoCardValue>
          </InfoCard>
        </InfoGrid>
      </ContentWrapper>
    </AssetDetailsContainer>
  )
}

export default AssetDetailsScreen
