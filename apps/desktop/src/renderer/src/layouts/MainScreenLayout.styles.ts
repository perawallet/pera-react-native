import styled from 'styled-components'

export const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-grey2);
  background-color: var(--color-background);
`

export const BackButton = styled.button`
  margin-right: var(--spacing-lg);
  color: var(--color-text-gray);
  &:hover {
    color: var(--color-grey5);
  }
`

export const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text-main);
`

export const ContentContainer = styled.div`
  flex: 1;
  overflow: auto;
`
