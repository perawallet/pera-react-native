/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Outside modules/connections the WalletConnect package is fair game.
import { abandonPairing } from '@perawallet/wallet-core-walletconnect'

export const uses = [abandonPairing]
