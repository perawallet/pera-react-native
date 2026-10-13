/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Both protocols may import shared, and their own siblings.
import { PERA_CLIENT_META } from '../shared'
import { createConnector } from './createConnector'

export const uses = [PERA_CLIENT_META, createConnector]
