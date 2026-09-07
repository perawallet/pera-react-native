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

import React, { useEffect, useState } from 'react'
// oxlint-disable-next-line no-restricted-imports -- pre-hydration boot screen;
// must not import @components/core (store-bearing graph) before hydration.
// lanekeep-ignore-next-line pera/no-primitive-rn-components reason: temporary bootstrap; real shell loaded dynamically after hydration
import { Text, View } from 'react-native'
import {
    getSurface,
    hydratePlatform,
    installOffscreenStorageShim,
} from '@perawallet/wallet-extension-platform-chrome/bootstrap'
// Bootstrap-only subpath: hydrateKeystoreStorage without the vendored ./keystore
// graph, whose large pure-JS crypto has no business loading before hydration.
import { hydrateKeystoreStorage } from '@perawallet/wallet-extension-keystore-chrome/bootstrap'

type ShellComponent = React.ComponentType

const OffscreenStatus = (): React.JSX.Element => (
    <View style={{ flex: 1 }}>
        <Text testID='offscreen-status'>offscreen host running</Text>
    </View>
)

// Outermost mount guard ABOVE ThemeProvider: AppShell's own boundary lives
// inside it, so a throw in theme construction or ThemeProvider itself would
// white-screen. Store-free and unthemed per this file's boot-order contract.
class RootBoundary extends React.Component<
    { children: React.ReactNode },
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
                <Text
                    testID='root-boundary-fallback'
                    style={{ marginBottom: 16 }}
                >
                    Pera Wallet failed to start.
                </Text>
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

export const App = (): React.JSX.Element => {
    const [Shell, setShell] = useState<ShellComponent | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const bootstrap = async (): Promise<void> => {
            const isOffscreen = getSurface() === 'offscreen'
            if (isOffscreen) {
                // Offscreen documents expose only chrome.runtime — install
                // the SW-proxied chrome.storage shim BEFORE any hydrator
                // reads chrome.storage.local.
                installOffscreenStorageShim()
            }
            await Promise.all([
                hydratePlatform(),
                // Nothing in the offscreen document reads keystore storage — no vault UI ever mounts there.
                ...(isOffscreen ? [] : [hydrateKeystoreStorage()]),
            ])

            if (isOffscreen) {
                // Headless surface; store-bearing imports stay behind this dynamic
                // import (same boot-order contract as AppShell).
                const mod = await import('@browser/offscreen/runOffscreenApp')
                await mod.runOffscreenApp()
                setShell(() => OffscreenStatus)
                return
            }

            // BOOT-ORDER CONTRACT: Zustand persist stores read getProvider().keyValueStorage
            // at module evaluation, which throws before hydrate() resolves. Everything
            // that transitively imports a store MUST stay behind this dynamic import.
            const mod = await import('./AppShell.web')
            setShell(() => mod.AppShell)
        }
        bootstrap().catch((err: unknown) => {
            // A dead offscreen document is worse than none: `hasDocument()` keeps
            // returning true so nothing ever recreates it and the database stays
            // unreachable until a manual reload. Closing lets `ensure-offscreen` rebuild it.
            if (getSurface() === 'offscreen') {
                console.error('[pera] offscreen bootstrap failed:', err)
                window.close()
                return
            }
            setError(`bootstrap failed: ${String(err)}`)
        })
    }, [])

    if (Shell)
        return (
            <RootBoundary>
                <Shell />
            </RootBoundary>
        )
    return (
        <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
            <Text testID='bootstrap-status'>
                {error ?? 'hydrating platform…'}
            </Text>
        </View>
    )
}
