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

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);

  h1 {
    font-size: 2.25rem;
    font-weight: bold;
    color: var(--color-text-main);
    flex-shrink: 1;
  }

  p {
    font-size: 1.125rem;
    color: var(--color-text-gray);
  }
`

const DiscoverHeader = (): React.ReactElement => {
  return (
    <HeaderContainer>
      <h1>Discover</h1>
      <p>Discover new assets and opportunities</p>
    </HeaderContainer>
  )
}

export default DiscoverHeader
