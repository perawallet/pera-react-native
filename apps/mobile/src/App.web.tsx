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

import React, { useEffect, useState } from 'react'
import {
    getSurface,
    hydratePlatform,
    installOffscreenStorageShim,
} from '@perawallet/wallet-extension-platform-chrome/bootstrap'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { OffscreenStatus } from './app-root/OffscreenStatus'
import { RootBoundary } from './app-root/RootBoundary'

type ShellComponent = React.ComponentType
const LOADING_DELAY_MS = 300

// Dynamic for the same boot-order reason as the surfaces themselves. Runs after
// a surface's module graph (which builds the provider) and before it starts.
const registerTransports = async (): Promise<void> => {
    const [{ getProvider }, { registerHardwareWalletTransports }] =
        await Promise.all([
            import('@perawallet/wallet-extension-provider'),
            import('./bootstrap/hardware-wallet-transports'),
        ])
    registerHardwareWalletTransports(getProvider().hardwareWalletRegistry)
}

export const App = (): React.JSX.Element => {
    const [Shell, setShell] = useState<Nullable<ShellComponent>>(null)
    const [bootstrapFailed, setBootstrapFailed] = useState(false)
    const [showLoading, setShowLoading] = useState(false)

    useEffect(() => {
        if (Shell || bootstrapFailed || getSurface() === 'offscreen') return
        const timer = setTimeout(() => setShowLoading(true), LOADING_DELAY_MS)
        return () => clearTimeout(timer)
    }, [Shell, bootstrapFailed])

    useEffect(() => {
        const bootstrap = async (): Promise<void> => {
            const isOffscreen = getSurface() === 'offscreen'
            if (isOffscreen) {
                // Offscreen documents expose only chrome.runtime — install
                // the SW-proxied chrome.storage shim BEFORE any hydrator
                // reads chrome.storage.local.
                installOffscreenStorageShim()
            }
            await hydratePlatform()

            if (isOffscreen) {
                // Headless surface; store-bearing imports stay behind these dynamic
                // imports (same boot-order contract as AppShell).
                const [
                    mod,
                    { registerChainAdapters },
                    { markDatabaseResetNoticePending },
                    { submitHandedOffSend },
                ] = await Promise.all([
                    import('@browser/offscreen/runOffscreenApp'),
                    import('./bootstrap/chain-adapters'),
                    import('./bootstrap/databaseResetNotice'),
                    import('./bootstrap/submitHandedOffSend'),
                ])
                await registerTransports()
                await mod.runOffscreenApp({
                    registerChainAdapters,
                    onDatabaseReset: markDatabaseResetNoticePending,
                    submitSignedTransactions: submitHandedOffSend,
                })
                setShell(() => OffscreenStatus)
                return
            }

            // BOOT-ORDER CONTRACT: Zustand persist stores read getProvider().keyValueStorage
            // at module evaluation, which throws before hydrate() resolves. Everything
            // that transitively imports a store MUST stay behind this dynamic import.
            const [mod, { initRuntime }] = await Promise.all([
                import('./AppShell.web'),
                import('./bootstrap/preReact.web'),
            ])
            initRuntime()
            await registerTransports()
            setShell(() => mod.AppShell)
        }
        bootstrap().catch((err: unknown) => {
            const surface = getSurface()
            console.error(`[pera] ${surface} bootstrap failed:`, err)
            // A dead offscreen document is worse than none: `hasDocument()` keeps
            // returning true so nothing ever recreates it and the database stays
            // unreachable until a manual reload. Closing lets `ensure-offscreen` rebuild it.
            if (surface === 'offscreen') {
                window.close()
                return
            }
            setBootstrapFailed(true)
        })
    }, [])

    if (Shell)
        return (
            <RootBoundary>
                <Shell />
            </RootBoundary>
        )
    if (bootstrapFailed)
        return (
            <div
                className='pera-bootstrap'
                role='alert'
            >
                {/* oxlint-disable-next-line pera/no-hardcoded-ui-strings -- bootstrap errors render before i18n can load */}
                Pera Wallet failed to start. Reopen the extension to try again.
            </div>
        )
    if (!showLoading) return <></>

    // The regular loading components import stores that require hydration.
    return (
        <div
            className='pera-bootstrap'
            role='status'
        >
            <img
                src='./icons/icon-128.png'
                alt='Pera Wallet'
            />
        </div>
    )
}
