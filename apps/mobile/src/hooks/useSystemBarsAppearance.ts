/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect } from 'react'
import { Platform } from 'react-native'
import { NavigationBar } from 'expo-navigation-bar'
import { setStatusBarStyle } from 'expo-status-bar'

/**
 * Keeps the OS status- and navigation-bar icons legible against the app's own
 * surfaces.
 *
 * Both bars are transparent under edge-to-edge (targetSdk 36), so drawing
 * readable icons is the app's job. Android resolves their contrast from
 * `Theme.AppCompat.DayNight`, which never sets `windowLightNavigationBar` — the
 * buttons stay light in both system themes and disappear on any light surface.
 * The theme is also the wrong input: `useIsDarkMode` is a user preference, so it
 * diverges from the system scheme whenever someone overrides it.
 *
 * `'dark'` means dark icons for a light background, so the styles are inverted
 * relative to `isDarkMode`.
 *
 * Android-only on purpose. iOS already gets both bars from the root navigator's
 * `statusBarStyle` option, and react-native-screens applies that through the
 * view controller — which requires `UIViewControllerBasedStatusBarAppearance:
 * true`, under which RN's imperative StatusBar API errors out. Android needs the
 * imperative path because react-native-screens stops managing either bar once
 * edge-to-edge is on.
 */
export const useSystemBarsAppearance = (isDarkMode: boolean): void => {
    useEffect(() => {
        if (Platform.OS !== 'android') return

        setStatusBarStyle(isDarkMode ? 'light' : 'dark')
        NavigationBar.setStyle(isDarkMode ? 'light' : 'dark')
    }, [isDarkMode])
}
