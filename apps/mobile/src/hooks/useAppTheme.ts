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

import { useMemo } from 'react'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getTheme } from '@theme/theme'

export type UseAppThemeResult = ReturnType<typeof getTheme>

// createTheme allocates a whole new theme object, so rebuilding it on every
// shell render would hand ThemeProvider a fresh value and re-render the tree.
export const useAppTheme = (): UseAppThemeResult => {
    const isDarkMode = useIsDarkMode()
    return useMemo(() => getTheme(isDarkMode ? 'dark' : 'light'), [isDarkMode])
}
