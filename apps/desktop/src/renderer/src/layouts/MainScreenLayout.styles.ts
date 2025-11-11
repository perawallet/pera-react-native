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

export const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-grey2);
  background-color: var(--color-background);
`

export const BackButton = styled.button`
  margin-right: var(--spacing-lg);
  color: var(--color-text-gray);
  &:hover {
    color: var(--color-grey5);
  }
`

export const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text-main);
`

export const ContentContainer = styled.div`
  flex: 1;
  overflow: auto;
`
