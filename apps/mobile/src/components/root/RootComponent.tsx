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

import { useDevice, useNetwork, usePolling } from '@perawallet/core'
import { config } from '@perawallet/config'
import { useEffect, useMemo, useRef } from 'react'
import { AppState, StatusBar, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MainRoutes } from '../../routes/routes'
import { getNavigationTheme, getTheme } from '../../theme/theme'
import { ThemeProvider } from '@rneui/themed'
import { useStyles } from './styles'
import PWView from '../../components/common/view/PWView'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import useToast from '../../hooks/toast'
import { useIsDarkMode } from '../../hooks/theme'
import { SigningProvider } from '../../providers/SigningProvider'

const RootContentContainer = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const insets = useSafeAreaInsets()
  const styles = useStyles(insets)
  const { network } = useNetwork()
  const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light')
  const { showToast } = useToast()

  const networkBarStyle = useMemo(() => {
    if (network === 'testnet') {
      return styles.testnetBar
    }
    return styles.mainnetBar
  }, [network, styles.testnetBar, styles.mainnetBar])

  const showError = (error: any) => {
    showToast({
      title: 'Error',
      body: config.debugEnabled
        ? `Details: ${error}`
        : 'An error has occured, please try again.',
      type: 'error',
    })
  }

  return (
    <ErrorBoundary onError={showError}>
      <PWView style={styles.container}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        />
        <View style={networkBarStyle} />
        <GestureHandlerRootView>
          <MainRoutes theme={navTheme} />
        </GestureHandlerRootView>
      </PWView>
    </ErrorBoundary>
  )
}

export const RootComponent = () => {
  const isDarkMode = useIsDarkMode()

  const theme = getTheme(isDarkMode ? 'dark' : 'light')
  const { registerDevice } = useDevice()
  const { startPolling, stopPolling } = usePolling()

  const appState = useRef(AppState.currentState)

  useEffect(() => {
    registerDevice()

    if (config.pollingEnabled) {
      const subscription = AppState.addEventListener(
        'change',
        nextAppState => {
          if (
            appState.current.match(/inactive|background/) &&
            nextAppState === 'active'
          ) {
            startPolling()
          } else if (
            appState.current === 'active' &&
            nextAppState.match(/inactive|background/)
          ) {
            stopPolling()
          }

          appState.current = nextAppState
        },
      )

      return () => {
        stopPolling()
        subscription.remove()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <SigningProvider>
        <RootContentContainer isDarkMode={isDarkMode} />
      </SigningProvider>
    </ThemeProvider>
  )
}
