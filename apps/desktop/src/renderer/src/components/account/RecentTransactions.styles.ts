import styled from 'styled-components';

export const RecentTransactionsContainer = styled.div`
  background-color: var(--color-background);
  border-radius: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  padding: 2rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
`;

export const Title = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: var(--spacing-xl);
`;

export const TransactionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
`;

export const TransactionItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  background-color: var(--color-layer-gray-lightest);
  border-radius: 0.75rem;
`;

export const TransactionDetails = styled.div`
  display: flex;
  align-items: center;
`;

export const TransactionIcon = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-white);
  margin-right: var(--spacing-lg);

  &.received {
    background-color: var(--color-success);
  }

  &.sent {
    background-color: var(--color-error);
  }
`;

export const TransactionInfo = styled.div`
  p:first-child {
    font-weight: 600;
    color: var(--color-text-main);
  }
  p:last-child {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`;

export const TransactionAmount = styled.div`
  text-align: right;
  p:first-child {
    font-weight: 600;
    &.received {
      color: var(--color-success);
    }
    &.sent {
      color: var(--color-error);
    }
  }
  p:last-child {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`;
