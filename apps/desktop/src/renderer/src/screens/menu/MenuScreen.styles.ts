import styled from 'styled-components'

export const MenuContainer = styled.div`
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

export const MenuGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  a {
    text-decoration: none;
  }
`

export const MenuItem = styled.div`
  background-color: var(--color-background);
  border-radius: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  padding: var(--spacing-xl);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }

  display: flex;
  align-items: center;
`

export const MenuItemIcon = styled.div`
  font-size: 1.875rem;
  margin-right: var(--spacing-lg);
  transition: transform 0.2s;

  ${MenuItem}:hover & {
    transform: scale(1.1);
  }
`

export const MenuItemContent = styled.div`
  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-xs);
  }

  p {
    color: var(--color-text-gray);
  }
`

export const VersionInfo = styled.div`
  margin-top: var(--spacing-xl);
  text-align: center;

  p {
    font-size: 0.875rem;
    color: var(--color-text-gray);
    margin-bottom: var(--spacing-xs);
  }

  .copyright {
    font-size: 0.75rem;
    color: var(--color-text-gray);
  }
`
