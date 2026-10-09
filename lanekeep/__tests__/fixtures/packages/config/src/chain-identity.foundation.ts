/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const scope: { chainId: string }

export const overlay = () => (scope.chainId === 'algorand' ? 1 : 0)
