import React from 'react'
import {
  LayoutContainer,
  HeaderContainer,
  BackButton,
  Title,
  ContentContainer
} from './MainScreenLayout.styles'

export type MainScreenLayoutProps = {
  fullScreen?: boolean
  showBack?: boolean
  title?: string
  header?: boolean
} & React.HTMLAttributes<HTMLDivElement>

const MainScreenLayout = (props: MainScreenLayoutProps): React.ReactElement => {
  const { showBack, title, header, className, children, ...rest } = props

  return (
    <LayoutContainer className={className} {...rest}>
      {header && (
        <HeaderContainer>
          {showBack && (
            <BackButton onClick={() => window.history.back()}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </BackButton>
          )}
          {title && <Title>{title}</Title>}
        </HeaderContainer>
      )}
      <ContentContainer>{children}</ContentContainer>
    </LayoutContainer>
  )
}

export default MainScreenLayout
