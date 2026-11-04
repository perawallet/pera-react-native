/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const scope: object
declare const legacyNetworkOf: (s: object) => string

export const network = legacyNetworkOf(scope)
