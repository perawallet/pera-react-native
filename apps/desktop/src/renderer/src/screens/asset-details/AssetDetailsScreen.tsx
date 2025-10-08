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
