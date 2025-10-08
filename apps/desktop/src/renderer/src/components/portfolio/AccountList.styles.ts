import styled from 'styled-components'
import { Card, CardContent } from '../../components/ui/card'

export const AccountListContainer = styled.div``

export const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: var(--spacing-xl);
`

export const AccountGrid = styled.div`
  display: grid;
  gap: var(--spacing-lg);

  a {
    text-decoration: none;
  }
`

export const AccountCard = styled(Card)`
  cursor: pointer;
  transition: box-shadow 0.2s;
  &:hover {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }
`

export const AccountCardContent = styled(CardContent)`
  padding: var(--spacing-xl);
`

export const AccountInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export const AccountDetails = styled.div`
  h3 {
    font-weight: 600;
    color: var(--color-text-main);
    font-size: 1.125rem;
  }
  p {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`

export const AccountBalance = styled.div`
  text-align: right;
  p {
    margin: 0;
    padding: 0;
  }
  p:first-child {
    font-size: 1.125rem;
    font-weight: bold;
    color: var(--color-text-main);
  }
  p:last-child {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`
