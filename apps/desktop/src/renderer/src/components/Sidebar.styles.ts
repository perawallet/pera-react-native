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

export const SidebarContainer = styled.div`
  width: 175px;
  height: calc(100vh - 36px);
  border-right: 1px solid var(--color-grey2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-lg) 0;
`

export const LogoContainer = styled.div`
  margin-bottom: var(--spacing-lg);
  padding: 0 var(--spacing-md);
`

export const LogoTitle = styled.h2`
  font-size: 18px;
  font-weight: 400;
  padding: 0;
  margin: 0;
`

export const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;

  a {
    text-decoration: none;
  }
`

export const ButtonContainer = styled.div`
  padding: 0 var(--spacing-md);

  button {
    width: 100%;
  }
`
