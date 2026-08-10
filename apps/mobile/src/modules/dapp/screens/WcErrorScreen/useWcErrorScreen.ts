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

import { useCallback, useMemo } from 'react'
import { AlgorandChain } from '@perawallet/wallet-core-walletconnect'
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest.web'

type TranslateFn = (key: string, values?: Record<string, unknown>) => string

type UseWcErrorScreenResult = {
    error: Error | null
    isLoading: boolean
    handleAcknowledge: () => void
}

// `AlgorandChain` is keyed by the four chain ids we know; a requested id comes
// off the wire and can be any number, so it is read through a widened lookup.
const chainNames: Record<number, string | undefined> = AlgorandChain

// Localised name for a WC chain id, matching the labels ConnectionViewHeader
// puts on its network badges. `AlgorandChain` names mainnet, testnet, betanet
// and the 4160 wildcard; betanet reaches this surface routinely, because
// `expectedChainIdForNetwork` can never match it, so it needs a real label
// (`networks_betanet`) rather than the raw number. Anything outside that map
// falls back to the id itself rather than rendering "undefined" at the user.
const chainLabel = (t: TranslateFn, chainId: number | undefined): string => {
    const name = chainId === undefined ? undefined : chainNames[chainId]
    if (!name) return chainId === undefined ? '' : String(chainId)
    return t(`walletconnect.request.networks_${name}`)
}

/**
 * Drives the notification-only surface for a handshake the offscreen host
 * already refused. There is no decision to take: the single button settles the
 * approval so the bridge closes the window (and so offscreen's one-surface
 * guard reopens for the next genuine mismatch).
 */
export const useWcErrorScreen = (): UseWcErrorScreenResult => {
    const { t } = useLanguage()
    const { approval, isLoading, reject } = useDappRequest()

    const wcError = approval?.kind === 'wc-error' ? approval : undefined

    const error = useMemo(() => {
        if (!wcError) return null
        // WalletConnectErrorContent renders `t(error.message)`, which returns
        // the message unchanged when it isn't a known key — so the message has
        // to arrive already localised and already interpolated (the component
        // passes no interpolation values of its own). Same contract mobile
        // relies on when it puts a real `Error.message` through that component.
        return new Error(
            t('walletconnect.request.error_network_mismatch', {
                requested: chainLabel(t, wcError.requestedChainId),
                active: t(
                    `walletconnect.request.networks_${wcError.activeNetwork}`,
                ),
            }),
        )
    }, [t, wcError])

    const handleAcknowledge = useCallback((): void => {
        void reject()
    }, [reject])

    return { error, isLoading, handleAcknowledge }
}
