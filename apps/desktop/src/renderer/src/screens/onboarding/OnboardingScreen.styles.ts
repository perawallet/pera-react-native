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

export const Container = styled.div`
  padding: var(--spacing-xl);
`

export const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-main);
`

export const Subtitle = styled.p`
  color: var(--color-text-gray);
`

export const ButtonContainer = styled.div`
  margin-top: var(--spacing-xl);
  text-align: center;
`

export const CreateButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1.125rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const ImportButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-grey4);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1.125rem;
  cursor: pointer;
  margin-left: var(--spacing-lg);
`
