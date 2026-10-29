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

export type RootBoundaryProps = { children: React.ReactNode }

// Outermost mount guard ABOVE ThemeProvider: AppShell's own boundary lives
// inside it, so a throw in theme construction or ThemeProvider itself would
// white-screen. Store-free and unthemed per App.web.tsx's boot-order contract.
export class RootBoundary extends React.Component<
    RootBoundaryProps,
    { hasError: boolean }
> {
    state = { hasError: false }

    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true }
    }

    render(): React.ReactNode {
        if (!this.state.hasError) return this.props.children
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                }}
            >
                {/* oxlint-disable-next-line pera/no-hardcoded-ui-strings -- the outermost error boundary renders before i18n can load */}
                <Text
                    testID='root-boundary-fallback'
                    style={{ marginBottom: 16 }}
                >
                    Pera Wallet failed to start.
                </Text>
                {/* oxlint-disable-next-line pera/no-hardcoded-ui-strings -- the outermost error boundary renders before i18n can load */}
                <Text
                    testID='root-boundary-reload'
                    accessibilityRole='button'
                    onPress={() => globalThis.location.reload()}
                    style={{ fontWeight: '600' }}
                >
                    Reload
                </Text>
            </View>
        )
    }
}
