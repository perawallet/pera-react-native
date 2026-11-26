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

import { useMemo } from 'react'
import {
    useTokenInboxQuery,
    useWalletHoldingSources,
} from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { InboxItem } from '@perawallet/wallet-core-messages'

export type TokenInbox = {
    scope: ChainScope
    item: Extract<InboxItem, { type: 'asa_inbox' }>
}

/**
 * One inbox row per address and network holding tokens that wait for the user
 * to accept or reject them. Kept on the device: no chain without opt-in has an
 * inbox contract, so the row reuses the asset inbox's shape and screens.
 */
export const useTokenInboxes = (): TokenInbox[] => {
    const sources = useWalletHoldingSources()
    const { holdings } = useTokenInboxQuery(sources)
    return useMemo(() => {
        const counts = new Map<string, number>()
        for (const { address, scope } of holdings) {
            const key = `${address}|${toScopeKey(scope)}`
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        return sources.flatMap(({ address, scope }): TokenInbox[] => {
            const requestCount = counts.get(`${address}|${toScopeKey(scope)}`)
            if (!requestCount) return []
            return [
                {
                    scope,
                    item: {
                        type: 'asa_inbox',
                        data: { address, inboxAddress: null, requestCount },
                        // Never read for an asset inbox row.
                        createdAt: new Date(0),
                    },
                },
            ]
        })
    }, [holdings, sources])
}
