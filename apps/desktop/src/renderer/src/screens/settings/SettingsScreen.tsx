import styled from 'styled-components'
import { useAppStore } from '@perawallet/core'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const Container = styled.div`
  padding: var(--spacing-xl);
  max-width: 64rem;
`

const Header = styled.div`
  margin-bottom: var(--spacing-xl);
  h1 {
    font-size: 2.25rem;
    font-weight: bold;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-sm);
  }
  p {
    font-size: 1.125rem;
    color: var(--color-text-gray);
  }
`

const BackButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-gray);
  cursor: pointer;
  font-size: 1rem;
  margin-bottom: var(--spacing-sm);
  padding: 0;

  &:hover {
    color: var(--color-text-main);
  }
`

const SettingsGrid = styled.div`
  display: grid;
  gap: var(--spacing-xl);
`

const SettingCard = styled.div`
  background-color: var(--color-background);
  border-radius: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  padding: var(--spacing-xl);
`

const SettingItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);

  &:last-child {
    margin-bottom: 0;
  }
`

const SettingLabel = styled.div`
  flex: 1;
  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-main);
    margin-bottom: var(--spacing-xs);
  }
  p {
    font-size: 0.875rem;
    color: var(--color-text-gray);
  }
`

const ThemeButtons = styled.div`
  display: flex;
  gap: var(--spacing-sm);
`

const ThemeButton = styled.button<{ active: boolean }>`
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid ${props => props.active ? 'var(--color-primary)' : 'var(--color-grey2)'};
  background-color: ${props => props.active ? 'var(--color-primary)' : 'var(--color-background)'};
  color: ${props => props.active ? 'var(--color-white)' : 'var(--color-text-main)'};
  border-radius: var(--spacing-sm);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;

  &:hover {
    border-color: var(--color-primary);
  }
`

const NetworkSwitch = styled.button`
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  background-color: var(--color-background);
  color: var(--color-text-main);
  border-radius: var(--spacing-sm);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;

  &:hover {
    border-color: var(--color-primary);
  }
`

const SettingsScreen = () => {
  const navigate = useNavigate()
  const theme = useAppStore(state => state.theme)
  const setTheme = useAppStore(state => state.setTheme)
  const network = useAppStore(state => state.network)
  const setNetwork = useAppStore(state => state.setNetwork)

  useEffect(() => {
    const applyTheme = () => {
      let effectiveTheme = theme
      if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      document.documentElement.setAttribute('data-theme', effectiveTheme)
    }

    applyTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const toggleNetwork = () => {
    setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet')
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate('/menu')}>← Back to Menu</BackButton>
        <h1>Settings</h1>
        <p>Configure your app preferences</p>
      </Header>

      <SettingsGrid>
        <SettingCard>
          <SettingItem>
            <SettingLabel>
              <h3>Theme</h3>
              <p>Choose your preferred theme</p>
            </SettingLabel>
            <ThemeButtons>
              <ThemeButton active={theme === 'light'} onClick={() => setTheme('light')}>
                Light
              </ThemeButton>
              <ThemeButton active={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </ThemeButton>
              <ThemeButton active={theme === 'system'} onClick={() => setTheme('system')}>
                System
              </ThemeButton>
            </ThemeButtons>
          </SettingItem>

          <SettingItem>
            <SettingLabel>
              <h3>Network</h3>
              <p>Switch between MainNet and TestNet</p>
            </SettingLabel>
            <NetworkSwitch onClick={toggleNetwork}>
              {network === 'mainnet' ? 'MainNet' : 'TestNet'}
            </NetworkSwitch>
          </SettingItem>
        </SettingCard>
      </SettingsGrid>
    </Container>
  );
};

export default SettingsScreen;
