import styled from 'styled-components'

export const PortfolioContainer = styled.div`
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

  h1 {
    color: var(--color-text-main);
    flex-shrink: 1;
  }
  p {
    font-size: 1.125rem;
    color: var(--color-text-gray);
  }
`
