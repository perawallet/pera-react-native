import styled from 'styled-components';
import { Button } from '../../components/ui/button';

export const ActionsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
  margin-bottom: 2rem;
`;

export const StyledButton = styled(Button)`
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &:hover {
    transform: scale(1.05);
  }

  &.export {
    background-color: var(--color-primary);
    color: var(--color-text-white);
    &:hover {
      background-color: var(--color-grey3);
    }
  }

  &.delete {
    background-color: var(--color-error);
    color: var(--color-text-white);
    &:hover {
      background-color: #dc2626;
    }
  }
`;
