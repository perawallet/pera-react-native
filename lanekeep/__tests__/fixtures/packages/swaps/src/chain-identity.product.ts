/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const scope: { chainId: string }

export const branch = () => {
    switch (scope.chainId) {
        default:
            return 0
    }
}
