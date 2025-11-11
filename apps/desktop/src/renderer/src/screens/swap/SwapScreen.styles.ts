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

export const SwapContainer = styled.div`
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

export const SwapCard = styled.div`
  background-color: var(--color-background);
  border-radius: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  padding: var(--spacing-xl);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
`

export const Section = styled.div`
  margin-bottom: var(--spacing-xl);

  &:last-child {
    margin-bottom: 0;
  }
`

export const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-gray);
  margin-bottom: var(--spacing-lg);
`

export const AssetInput = styled.div`
  display: flex;
  align-items: center;
  background-color: var(--color-grey0);
  border-radius: var(--spacing-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
`

export const AssetInfo = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
`

export const AssetIcon = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  background-color: var(--color-primary);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-weight: bold;
  margin-right: var(--spacing-lg);
`

export const AssetDetails = styled.div`
  .asset-name {
    font-weight: 600;
    color: var(--color-text-main);
  }

  .asset-symbol {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`

export const AmountInput = styled.input`
  text-align: right;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text-main);
  background: transparent;
  border: none;
  outline: none;
  width: 8rem;
`

export const SwapButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: var(--spacing-xl) 0;
`

export const SwapIconButton = styled.button`
  width: 3rem;
  height: 3rem;
  background-color: var(--color-primary);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }
`

export const SwapDetails = styled.div`
  background-color: var(--color-grey0);
  border-radius: var(--spacing-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
`

export const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: var(--spacing-sm);

  &:last-child {
    margin-bottom: 0;
  }

  .label {
    color: var(--color-text-gray);
  }

  .value {
    color: var(--color-text-main);
    font-weight: 500;
  }
`

export const ExecuteSwapButton = styled.button`
  width: 100%;
  background-color: var(--color-primary);
  color: var(--color-white);
  padding: var(--spacing-lg) var(--spacing-xl);
  border-radius: var(--spacing-lg);
  font-weight: 600;
  font-size: 1.125rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &:hover {
    background-color: var(--color-primary);
    opacity: 0.9;
    transform: scale(1.02);
  }
`
