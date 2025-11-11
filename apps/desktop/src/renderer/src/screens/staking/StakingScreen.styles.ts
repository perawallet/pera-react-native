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

export const StakingContainer = styled.div`
  padding: 0 var(--spacing-xl);
  max-width: 96rem;
  display: flex;
  flex-direction: column;
`

export const Header = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);

  h1 {
    color: var(--color-text-main);
    flex-shrink: 1;
  }
  p {
    font-size: 1.125rem;
    color: var(--color-text-gray);
  }
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
`

export const Card = styled.div`
  padding: var(--spacing-xl);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-lg);
  background-color: var(--color-background);

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--color-text-gray);
  }
`
