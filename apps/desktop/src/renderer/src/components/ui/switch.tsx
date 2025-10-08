import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import styled from 'styled-components'

const StyledSwitchRoot = styled(SwitchPrimitives.Root)`
  &.peer {
    /* Define base styles for the switch */
    display: inline-flex;
    height: 1.5rem; /* h-6 */
    width: 2.75rem; /* w-11 */
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 9999px; /* rounded-full */
    border: 2px solid transparent;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke,
      opacity, box-shadow, transform, filter, backdrop-filter;
    transition-duration: 200ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); /* transition-colors */
    align-items: center;

    &:focus-visible {
      outline: 2px solid #2563eb; /* focus-visible:ring-2 focus-visible:ring-ring */
      outline-offset: 2px; /* focus-visible:ring-offset-2 focus-visible:ring-offset-background */
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &[data-state='checked'] {
      background-color: #111827; /* data-[state=checked]:bg-primary */
    }

    &[data-state='unchecked'] {
      background-color: #d1d5db; /* data-[state=unchecked]:bg-input */
    }
  }
`

const StyledSwitchThumb = styled(SwitchPrimitives.Thumb)`
  /* Define styles for the switch thumb */
  pointer-events: none;
  display: block;
  height: 1.25rem; /* h-5 */
  width: 1.25rem; /* w-5 */
  border-radius: 9999px; /* rounded-full */
  background-color: #ffffff; /* bg-background */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); /* shadow-lg */
  ring: 0;
  transition-property: transform;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); /* transition-transform */

  &[data-state='checked'] {
    transform: translateX(20px); /* data-[state=checked]:translate-x-5 */
  }

  &[data-state='unchecked'] {
    transform: translateX(0); /* data-[state=unchecked]:translate-x-0 */
  }
`

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <StyledSwitchRoot className={className} {...props} ref={ref}>
    <StyledSwitchThumb />
  </StyledSwitchRoot>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
