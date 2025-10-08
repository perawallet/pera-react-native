import * as React from 'react'
import styled, { css } from 'styled-components'

const activeStyles = css`
  color: var(--color-text-main);
  font-weight: 600;
  background: var(--color-layer-gray-lighter);
`

export interface MenuItemProps extends React.PropsWithChildren {
  active?: boolean
}

const MenuItem = styled.div<MenuItemProps>`
  display: flex;
  flex-direction: row;
  gap: var(--spacing-xl);
  align-items: center;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  color: var(--color-text-gray);
  padding: var(--spacing-md);

  &:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  &:disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  ${({ active }) => active && activeStyles}
`

MenuItem.displayName = 'MenuItem'

export { MenuItem }
