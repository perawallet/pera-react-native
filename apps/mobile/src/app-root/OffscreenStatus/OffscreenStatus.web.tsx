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

/* oxlint-disable react-native/no-inline-styles, react-native/no-color-literals -- minimal pre-hydration bootstrap shell */

import React from 'react'
// oxlint-disable-next-line no-restricted-imports -- pre-hydration boot screen;
// must not import @components/core (store-bearing graph) before hydration.
// lanekeep-ignore-next-line pera/no-primitive-rn-components reason: temporary bootstrap; real shell loaded dynamically after hydration
import { Text, View } from 'react-native'

export const OffscreenStatus = (): React.JSX.Element => (
    <View style={{ flex: 1 }}>
        {/* oxlint-disable-next-line pera/no-hardcoded-ui-strings -- e2e status probe in the offscreen document, never shown to a user */}
        <Text testID='offscreen-status'>offscreen host running</Text>
    </View>
)
