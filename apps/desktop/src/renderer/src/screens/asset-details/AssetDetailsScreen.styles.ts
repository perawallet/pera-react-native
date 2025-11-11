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
