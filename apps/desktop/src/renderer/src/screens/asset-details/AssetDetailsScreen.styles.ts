import styled from 'styled-components'

export const AssetDetailsContainer = styled.div`
  padding: var(--spacing-lg);
`

export const Header = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: var(--spacing-lg);
`

export const Description = styled.p`
  margin-bottom: var(--spacing-lg);
`

export const ContentWrapper = styled.div`
  margin-top: var(--spacing-lg);
`

export const AssetCard = styled.div`
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: 0.25rem;
  margin-bottom: var(--spacing-lg);
`

export const AssetTitle = styled.h3`
  font-weight: 600;
  font-size: 1.125rem;
`

export const AssetSubtitle = styled.p`
  font-size: 0.875rem;
  color: var(--color-text-gray);
`

export const AssetPrice = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: var(--spacing-sm);
`

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
`

export const InfoCard = styled.div`
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: 0.25rem;
`

export const InfoCardTitle = styled.h4`
  font-weight: 600;
`

export const InfoCardValue = styled.p``
