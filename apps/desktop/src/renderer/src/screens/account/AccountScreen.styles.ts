import styled from 'styled-components'

export const AccountScreenContainer = styled.div`
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
