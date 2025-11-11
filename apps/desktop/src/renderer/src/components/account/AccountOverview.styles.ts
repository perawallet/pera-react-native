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

export const AccountOverviewContainer = styled.div`
  background-color: var(--color-background);
  border-radius: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
`

export const AccountHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-xl);
`

export const Avatar = styled.div`
  width: 4rem;
  height: 4rem;
  background-color: var(--color-secondary);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-white);
  font-size: 1.5rem;
  font-weight: bold;
  margin-right: var(--spacing-lg);
`

export const AccountTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-main);
`

export const AccountSubtitle = styled.p`
  color: var(--color-text-gray);
`

export const AccountGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
`

export const InfoCard = styled.div`
  background-color: var(--color-layer-gray-lightest);
  border-radius: 0.75rem;
  padding: var(--spacing-xl);
`

export const InfoCardTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: var(--spacing-sm);
`

export const Address = styled.p`
  font-size: 0.875rem;
  color: var(--color-text-gray);
  font-family: monospace;
  word-break: break-all;
`

export const CopyButton = styled.button`
  margin-top: var(--spacing-lg);
  color: var(--color-secondary);
  font-weight: 500;
  font-size: 0.875rem;
  background: none;
  border: none;
  cursor: pointer;
  &:hover {
    color: var(--color-grey3);
  }
`

export const Balance = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text-main);
`
