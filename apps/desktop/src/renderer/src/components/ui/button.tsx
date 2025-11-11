/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import styled, { css } from 'styled-components'

const variantStyles = {
  default: css`
    background-color: #111827;
    color: #f9fafb;
    &:hover {
      background-color: #1f2937;
    }
  `,
  destructive: css`
    background-color: #ef4444;
    color: #f9fafb;
    &:hover {
      background-color: #dc2626;
    }
  `,
  outline: css`
    border: 1px solid #d1d5db;
    background-color: transparent;
    &:hover {
      background-color: #f3f4f6;
      color: #111827;
    }
  `,
  secondary: css`
    background-color: #f3f4f6;
    color: #111827;
    &:hover {
      background-color: #e5e7eb;
    }
  `,
  ghost: css`
    &:hover {
      background-color: #f3f4f6;
      color: #111827;
    }
  `,
  link: css`
    color: #111827;
    text-decoration: underline;
  `
}

const sizeStyles = {
  default: css`
    height: 40px;
    padding: 0 var(--spacing-lg);
  `,
  sm: css`
    height: 36px;
    padding: 0 var(--spacing-md);
  `,
  lg: css`
    height: 44px;
    padding: 0 32px;
  `,
  icon: css`
    height: 40px;
    width: 40px;
  `
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles
  size?: keyof typeof sizeStyles
  asChild?: boolean
}

const StyledButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.2s;

  &:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  &:disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  ${({ variant }) => variantStyles[variant || 'default']}
  ${({ size }) => sizeStyles[size || 'default']}
`

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : StyledButton
    return <Comp variant={variant} size={size} ref={ref} {...props} asChild={asChild} />
  }
)
Button.displayName = 'Button'

export { Button }
