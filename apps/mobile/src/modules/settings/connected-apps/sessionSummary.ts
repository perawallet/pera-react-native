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

import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import type { LiquidAuthSession } from '@perawallet/wallet-core-liquid-auth'

export type ConnectedAppType = 'walletconnect' | 'liquidauth'

export type SessionSummary = {
    type: ConnectedAppType
    /** stable id for keys + navigation (WC clientId / Liquid sessionId) */
    id: string
    name: string
    icon?: string
    /** dApp url or signaling origin/host */
    origin?: string
    accounts: string[]
    createdAt?: Date
    lastActiveAt?: Date
    connected?: boolean
}

const pickPreferredIcon = (icons?: string[]): string | undefined => {
    if (!icons?.length) {
        return undefined
    }
    return (
        icons.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg') ||
                icon.endsWith('.gif'),
        ) ?? icons[0]
    )
}

export const walletConnectToSummary = (
    connection: WalletConnectConnection,
): SessionSummary => {
    const peerMeta = connection.session?.peerMeta
    return {
        type: 'walletconnect',
        id: connection.clientId ?? '',
        name: peerMeta?.name ?? 'Unknown',
        icon: pickPreferredIcon(peerMeta?.icons),
        origin: peerMeta?.url,
        accounts: connection.session?.accounts ?? [],
        createdAt: connection.createdAt,
        lastActiveAt: connection.lastActiveAt,
        connected: connection.session?.connected,
    }
}

export const liquidAuthToSummary = (
    session: LiquidAuthSession,
): SessionSummary => {
    return {
        type: 'liquidauth',
        id: session.sessionId,
        name: session.peerMeta?.name ?? session.host ?? 'Unknown',
        icon: session.peerMeta?.icon,
        origin: session.peerMeta?.origin ?? session.host,
        accounts: session.accounts ?? [],
        createdAt: session.createdAt ? new Date(session.createdAt) : undefined,
        lastActiveAt: session.lastActiveAt
            ? new Date(session.lastActiveAt)
            : undefined,
        connected: true,
    }
}
