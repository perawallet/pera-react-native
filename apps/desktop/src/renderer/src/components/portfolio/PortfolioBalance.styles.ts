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
import { Card } from '../../components/ui/card'

export const BalanceCard = styled(Card)`
  border: 0;
  box-shadow: none;
`

export const StyledCardTitle = styled.h3`
  font-size: 1.25rem;
  color: var(--color-text-gray);
`

export const BalanceContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
`

export const BalanceAmount = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`

export const PrimaryBalance = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text-main);
`

export const SecondaryBalance = styled.div`
  font-size: 1rem;
  color: var(--color-text-gray);
`
