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

export const ActionsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--spacing-lg);
  gap: var(--spacing-lg);
`

export const ActionButton = styled.button`
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &:hover {
    transform: scale(1.05);
  }
`
