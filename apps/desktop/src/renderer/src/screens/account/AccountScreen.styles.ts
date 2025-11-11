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

export const AccountScreenContainer = styled.div`
  padding: var(--spacing-xl);
  max-width: 64rem;
`

export const Header = styled.div`
  margin-bottom: var(--spacing-xl);
  h1 {
    font-size: 2.25rem;
    font-weight: bold;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-sm);
  }
  p {
    font-size: 1.125rem;
    color: var(--color-text-gray);
  }
`

export const BackButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-gray);
  cursor: pointer;
  font-size: 1rem;
  margin-bottom: var(--spacing-sm);
  padding: 0;

  &:hover {
    color: var(--color-text-main);
  }
`
