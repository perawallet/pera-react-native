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

export const SettingsGrid = styled.div`
  display: grid;
  gap: var(--spacing-xl);
`

export const SettingCard = styled.div`
  background-color: var(--color-background);
  border-radius: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  padding: var(--spacing-xl);
`

export const SettingItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);

  &:last-child {
    margin-bottom: 0;
  }
`

export const SettingLabel = styled.div`
  flex: 1;
  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-xs);
  }
  p {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`

export const ThemeButtons = styled.div`
  display: flex;
  gap: var(--spacing-sm);
`

export const ThemeButton = styled.button<{ active: boolean }>`
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-grey2)')};
  background-color: ${(props) =>
    props.active ? 'var(--color-primary)' : 'var(--color-background)'};
  color: ${(props) => (props.active ? 'var(--color-white)' : 'var(--color-text-main)')};
  border-radius: var(--spacing-sm);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;

  &:hover {
    border-color: var(--color-primary);
  }
`

export const NetworkSwitch = styled.button`
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  background-color: var(--color-background);
  color: var(--color-text-main);
  border-radius: var(--spacing-sm);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;

  &:hover {
    border-color: var(--color-primary);
  }
`
