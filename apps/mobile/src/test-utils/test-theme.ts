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

import type { CreateThemeOptions } from '@rneui/themed'

// The integration setup installs the app's own theme here so real components
// resolve every token they read. It is not imported by render.tsx directly:
// the typography scale reads react-native's Platform at import, which specs
// that mock react-native partially don't provide. Unit tests mock
// @rneui/themed, whose makeStyles ignores the provider's theme.
let testTheme: CreateThemeOptions = {}

export const setTestTheme = (theme: CreateThemeOptions): void => {
    testTheme = theme
}

export const getTestTheme = (): CreateThemeOptions => testTheme
