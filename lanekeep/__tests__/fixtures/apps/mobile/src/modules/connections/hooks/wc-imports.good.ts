/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// The connections module reaches the protocol through the registry only.
import { waitForPairingOutcome } from '@perawallet/wallet-core-connections'
import { withTimeout } from '@hooks/deeplink/handlers/timeout'

export * from '@perawallet/wallet-core-connections'
export const load = () => import('@perawallet/wallet-core-connections')

export const uses = [waitForPairingOutcome, withTimeout]
