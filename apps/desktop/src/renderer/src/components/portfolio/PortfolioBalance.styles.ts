import styled from 'styled-components'
import { Card } from '../../components/ui/card'

export const BalanceCard = styled(Card)`
  border: 0;
  box-shadow: none;
`

export const StyledCardTitle = styled.h3`
  font-size: 1.25rem;
  color: var(--color-text-gray);
`

export const BalanceContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
`

export const BalanceAmount = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`

export const PrimaryBalance = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text-main);
`

export const SecondaryBalance = styled.div`
  font-size: 1rem;
  color: var(--color-text-gray);
`

