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

import { afterEach, vi } from 'vitest'

// Each module registers its vi.mock calls when imported. dom-style patches
// React.createElement, so it stays first.
import './src/test-utils/mocks/dom-style'
import './src/test-utils/mocks/platform'
import './src/test-utils/mocks/react-native'
import './src/test-utils/mocks/native-modules'
import './src/test-utils/mocks/expo'
import './src/test-utils/mocks/firebase'
import './src/test-utils/mocks/navigation'
import './src/test-utils/mocks/animation-gesture'
import './src/test-utils/mocks/third-party-ui'
import './src/test-utils/mocks/rneui'
import './src/test-utils/mocks/pw-icon'
import './src/test-utils/mocks/wallet-core-shared'
import './src/test-utils/mocks/wallet-core'

afterEach(() => {
    vi.clearAllMocks()
})
