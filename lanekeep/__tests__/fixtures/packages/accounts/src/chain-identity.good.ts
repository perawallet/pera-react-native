declare const scope: { chainId: string; networkId: string }
declare const isChainId: (value: unknown) => boolean

export const valid = isChainId(scope.chainId)
// switch (scope.chainId)
/** the 'algorand' namespace */
export const wc = 'algorand-wc'
export const keyed = { algorand: 1 }
export const nonEmpty = scope.chainId.length > 0
export const network = () => {
    switch (scope.networkId) {
        default:
            return 0
    }
}
