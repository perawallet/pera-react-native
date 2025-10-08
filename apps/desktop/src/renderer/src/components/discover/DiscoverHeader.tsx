import styled from 'styled-components'

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);

  h1 {
    font-size: 2.25rem;
    font-weight: bold;
    color: var(--color-text-main);
    flex-shrink: 1;
  }

  p {
    font-size: 1.125rem;
    color: var(--color-text-gray);
  }
`

const DiscoverHeader = (): React.ReactElement => {
  return (
    <HeaderContainer>
      <h1>Discover</h1>
      <p>Discover new assets and opportunities</p>
    </HeaderContainer>
  )
}

export default DiscoverHeader
