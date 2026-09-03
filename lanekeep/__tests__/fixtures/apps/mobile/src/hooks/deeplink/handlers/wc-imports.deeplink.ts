/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for apps/mobile/src/hooks/deeplink/handlers/useWalletConnectDeeplink.ts
import { walletConnectLogContext } from '@perawallet/wallet-core-walletconnect'
import type { WalletConnectPairingResult } from '@perawallet/wallet-core-walletconnect'

export const uses = [
    walletConnectLogContext,
    null as unknown as WalletConnectPairingResult,
]
