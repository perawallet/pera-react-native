import styled from 'styled-components'

export const StakingContainer = styled.div`
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

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
`

export const Card = styled.div`
  padding: var(--spacing-xl);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-lg);
  background-color: var(--color-background);

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--color-text-gray);
  }
`
