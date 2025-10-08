import { useAppStore } from '@perawallet/core'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  BackButton,
  SettingsGrid,
  SettingCard,
  SettingItem,
  SettingLabel,
  ThemeButtons,
  ThemeButton,
  NetworkSwitch
} from './SettingsScreen.styles'

const SettingsScreen = (): React.ReactElement => {
  const navigate = useNavigate()
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const network = useAppStore((state) => state.network)
  const setNetwork = useAppStore((state) => state.setNetwork)

  useEffect(() => {
    const applyTheme = (): void => {
      let effectiveTheme = theme
      if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }
      document.documentElement.setAttribute('data-theme', effectiveTheme)
    }

    applyTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (): void => applyTheme()
      mediaQuery.addEventListener('change', handleChange)
      return (): void => mediaQuery.removeEventListener('change', handleChange)
    }

    return () => {}
  }, [theme])

  const toggleNetwork = (): void => {
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
  )
}

export default SettingsScreen
