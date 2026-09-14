/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for packages/walletconnect/src/v2/handler.ts
import { connectorRegistry } from '../v1/connectorRegistry'
import type { V1Session } from '../v1/types'

export const uses = [connectorRegistry, null as unknown as V1Session]
