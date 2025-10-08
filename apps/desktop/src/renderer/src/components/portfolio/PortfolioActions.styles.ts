import styled from 'styled-components'

export const ActionsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--spacing-lg);
  gap: var(--spacing-lg);

`

export const ActionButton = styled.button`
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &:hover {
    transform: scale(1.05);
  }
`
