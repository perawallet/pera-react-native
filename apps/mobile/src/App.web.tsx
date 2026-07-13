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
/* oxlint-disable react-native/no-inline-styles, react-native/no-color-literals -- temporary M1 bootstrap; replaced by makeStyles shell in milestone 3 */

import React, { useEffect, useState } from 'react'
// oxlint-disable-next-line no-restricted-imports -- pre-hydration boot screen;
// must not import @components/core (store-bearing graph) before hydration.
// guardrails-ignore-next-line: no-primitive-rn-components -- temporary bootstrap; real shell loaded dynamically after hydration
import { Text, View } from 'react-native'
import { hydratePlatform } from '@perawallet/wallet-extension-platform-driver'
// Bootstrap-only subpath: exports hydrateKeystoreStorage without pulling the full
// @algorandfoundation/keystore graph (sign.js / verify.js use node:crypto which
// routes to the native bridge on web). The /bootstrap subpath is storage-only.
import { hydrateKeystoreStorage } from '@perawallet/wallet-extension-keystore-chrome/bootstrap'

type ShellComponent = React.ComponentType

export const App = (): React.JSX.Element => {
    const [Shell, setShell] = useState<ShellComponent | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const bootstrap = async (): Promise<void> => {
            await Promise.all([hydratePlatform(), hydrateKeystoreStorage()])
            // BOOT-ORDER CONTRACT: Zustand persist stores read
            // getProvider().keyValueStorage at module evaluation, which throws
            // before hydrate() resolves. Everything that (transitively)
            // imports a store MUST live behind this dynamic import. Never add
            // a static import of app code to this file.
            const mod = await import('./AppShell.web')
            setShell(() => mod.AppShell)
        }
        bootstrap().catch(err => {
            setError(`bootstrap failed: ${String(err)}`)
        })
    }, [])

    if (Shell) return <Shell />
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
