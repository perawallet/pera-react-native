import styled from 'styled-components'

export const SidebarContainer = styled.div`
  width: 175px;
  height: calc(100vh - 36px);
  border-right: 1px solid var(--color-grey2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-lg) 0;
`

export const LogoContainer = styled.div`
  margin-bottom: var(--spacing-lg);
  padding: 0 var(--spacing-md);
`

export const LogoTitle = styled.h2`
  font-size: 18px;
  font-weight: 400;
  padding: 0;
  margin: 0;
`

export const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;

  a {
    text-decoration: none;
  }
`

export const ButtonContainer = styled.div`
  padding: 0 var(--spacing-md);

  button {
    width: 100%;
  }
`
