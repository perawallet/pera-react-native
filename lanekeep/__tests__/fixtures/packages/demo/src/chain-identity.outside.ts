declare const scope: { chainId: string }

export const branch = () => {
    switch (scope.chainId) {
        default:
            return 0
    }
}
export const d = 'algorand'
