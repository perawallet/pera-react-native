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

import { useEffect, useRef } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { registerAppIntegrity } from '../services/registerAppIntegrity'
import { useAppIntegrityStore } from '../store'

// Re-register when within this margin of expiry.
const EXPIRY_MARGIN_MS = 12 * 60 * 60 * 1000

const hasValidToken = (): boolean => {
    const { integrityToken, expiresAt } = useAppIntegrityStore.getState()
    if (!integrityToken || !expiresAt) return false
    const expiry = new Date(expiresAt).getTime()
    if (Number.isNaN(expiry)) return false
    return expiry - Date.now() > EXPIRY_MARGIN_MS
}

/**
 * Fire-and-forget startup attestation. Runs once on boot and never blocks it.
 * Attestation proceeds on distributed (staging + production) builds;
 * `registerAppIntegrity` no-ops with status `skipped` on development builds.
 */
export const useAppIntegrityBootstrap = (scope: ChainScope): void => {
    const hasRun = useRef(false)

    useEffect(() => {
        if (hasRun.current) return
        hasRun.current = true

        if (hasValidToken()) return

        void registerAppIntegrity({ scope })
        // Boot-once handshake: `hasRun` makes later scope changes a no-op, so
        // registration always uses the scope captured on the first run.
    }, [scope])
}
