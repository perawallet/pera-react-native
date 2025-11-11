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
import { Button } from '../../components/ui/button'

export const ActionsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
  margin-bottom: 2rem;
`

export const StyledButton = styled(Button)`
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &:hover {
    transform: scale(1.05);
  }

  &.export {
    background-color: var(--color-primary);
    color: var(--color-text-white);
    &:hover {
      background-color: var(--color-grey3);
    }
  }

  &.delete {
    background-color: var(--color-error);
    color: var(--color-text-white);
    &:hover {
      background-color: #dc2626;
    }
  }
`
