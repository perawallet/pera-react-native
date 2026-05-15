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

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { walletConnectHandoffs } from '@perawallet/wallet-core-signing'
import {
    startPolling,
    type ResolverContext,
    type ResolverMessages,
} from './resolveWalletConnectHandoff'

/**
 * Resolves WalletConnect sync-flow multisig handoffs.
 *
 * For each pending handoff registered by `createMultisigProposeTransport`,
 * this hook polls `POST /sign-requests/with-signatures/` until a terminal
 * status arrives, then delivers the outcome to the dApp via the handoff's
 * WC callbacks:
 *   - `'ready'` / `'confirmed'`: assemble the composite multisig signed
 *     transaction(s) and hand them to `approveSignedBytes`.
 *   - `'declined'` / `'expired'`: `softReject` — a clean rejection with no
 *     in-app connection-error banner.
 *   - `'failed'`: `error` — the connection-error banner is appropriate.
 *
 * Mounted once at the app root. The handoff registry is in-memory, so an
 * app kill drops tracking — the on-chain sign-request still exists and the
 * user can finish it from the inbox flow.
 *
 * There is no Android analog: Android fetches sign-request status on demand
 * from a ViewModel when the user opens the joint-account screen. RN polls in
 * the background because the WC peer is blocked on `approveRequest` with no
 * UI surface to drive the fetch.
 */
export const useWalletConnectHandoffResolver = (): void => {
    const { t } = useTranslation()

    // Re-render whenever a handoff is registered / unregistered. The
    // snapshot is the registry's monotonic version, not its list length —
    // length would miss a same-tick unregister+register that collapses to
    // the same count and so skip the effect re-run.
    const version = useSyncExternalStore(
        walletConnectHandoffs.subscribe,
        walletConnectHandoffs.getVersion,
        () => 0,
    )

    // Per-resolver state, shared with the polling state machine. `resolved`
    // guards against a late poll landing after the terminal callback fired;
    // `timers` lets us cancel in-flight polls when a handoff is unregistered
    // externally (e.g. user dismisses) or on unmount.
    const resolvedRef = useRef<Set<string>>(new Set())
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
        new Map(),
    )

    const messages = useMemo<ResolverMessages>(
        () => ({
            declined: t('multisig.sync_sign.errors.declined'),
            expired: t('multisig.sync_sign.errors.expired'),
            failed: t('multisig.sync_sign.errors.failed'),
            noTransactions: t('multisig.sync_sign.errors.no_transactions'),
            deliveryFailed: t('multisig.sync_sign.errors.delivery_failed'),
            assemblyFailed: (reason: string) =>
                t('multisig.sync_sign.errors.assembly_failed', { reason }),
        }),
        [t],
    )

    useEffect(() => {
        const ctx: ResolverContext = {
            messages,
            resolved: resolvedRef.current,
            timers: timersRef.current,
        }
        const handoffs = walletConnectHandoffs.list()
        const activeIds = new Set(handoffs.map(h => h.signRequestId))

        // Cancel timers for handoffs that are no longer in the registry.
        for (const [id, timer] of timersRef.current.entries()) {
            if (!activeIds.has(id)) {
                clearTimeout(timer)
                timersRef.current.delete(id)
            }
        }

        // Start polling for each newly registered handoff.
        for (const handoff of handoffs) {
            if (resolvedRef.current.has(handoff.signRequestId)) continue
            if (timersRef.current.has(handoff.signRequestId)) continue
            startPolling(handoff, ctx)
        }
    }, [version, messages])

    // Cancel all timers on unmount.
    useEffect(() => {
        const timers = timersRef.current
        return () => {
            for (const timer of timers.values()) clearTimeout(timer)
            timers.clear()
        }
    }, [])
}
