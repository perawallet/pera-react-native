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
  margin-bottom: var(--spacing-lg);
`

export const FormContainer = styled.div`
  margin-top: var(--spacing-lg);
`

export const FormGroup = styled.div`
  margin-bottom: var(--spacing-lg);
`

export const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-main);
`

export const Textarea = styled.textarea`
  width: 100%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-sm);
  height: 6rem;
  font-size: 1rem;
  color: var(--color-text-main);
  background-color: var(--color-background);
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

export const Input = styled.input`
  width: 100%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-sm);
  font-size: 1rem;
  color: var(--color-text-main);
  background-color: var(--color-background);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

export const ImportButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1rem;
  cursor: pointer;
`
