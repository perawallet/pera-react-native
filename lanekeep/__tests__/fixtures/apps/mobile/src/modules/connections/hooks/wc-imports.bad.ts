/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for apps/mobile/src/modules/connections/hooks/useConnectionPairing.ts
import { abandonPairing } from '@perawallet/wallet-core-walletconnect'
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import { WALLET_CONNECT_V1_KIND } from '@perawallet/wallet-core-walletconnect/v1'

export type { WalletConnectV1Connection } from '@perawallet/wallet-core-walletconnect'
export * from '@perawallet/wallet-core-walletconnect'

export const load = () => import('@perawallet/wallet-core-walletconnect')

export const uses = [
    abandonPairing,
    WALLET_CONNECT_V1_KIND,
    null as unknown as WalletConnectConnection,
]
