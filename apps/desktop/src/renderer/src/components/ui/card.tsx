import * as React from 'react'
import styled from 'styled-components'

const StyledCard = styled.div`
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  color: #111827;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  &.dark {
    background-color: #1a202c;
    color: #f9fafb;
    border-color: #374151;
  }
`

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => <StyledCard ref={ref} {...props} />
)
Card.displayName = 'Card'

const StyledCardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: var(--spacing-xl);
`

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => <StyledCardHeader ref={ref} {...props} />
)
CardHeader.displayName = 'CardHeader'

const StyledCardTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  line-height: none;
  letter-spacing: -0.025em;
`

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ ...props }, ref) => <StyledCardTitle ref={ref} {...props} />
)
CardTitle.displayName = 'CardTitle'

const StyledCardDescription = styled.p`
  font-size: 0.875rem;
  color: #6b7280;

  &.dark {
    color: #9ca3af;
  }
`

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ ...props }, ref) => <StyledCardDescription ref={ref} {...props} />)
CardDescription.displayName = 'CardDescription'

const StyledCardContent = styled.div`
  padding: var(--spacing-xl);
  padding-top: 0;
`

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => <StyledCardContent ref={ref} {...props} />
)
CardContent.displayName = 'CardContent'

const StyledCardFooter = styled.div`
  display: flex;
  align-items: center;
  padding: var(--spacing-xl);
  padding-top: 0;
`

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => <StyledCardFooter ref={ref} {...props} />
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
