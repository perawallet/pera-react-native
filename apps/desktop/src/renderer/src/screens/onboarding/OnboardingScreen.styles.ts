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
`

export const ButtonContainer = styled.div`
  margin-top: var(--spacing-xl);
  text-align: center;
`

export const CreateButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1.125rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const ImportButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-grey4);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1.125rem;
  cursor: pointer;
  margin-left: var(--spacing-lg);
`
