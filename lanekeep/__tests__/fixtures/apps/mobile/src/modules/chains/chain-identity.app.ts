declare const scope: { chainId: string }
declare const family: string
declare const x: string

export const pinned = { chainId: 'algorand' }
export const isAlgorand = family === 'algorand'
export const notEthereum = 'ethereum' !== x
export const byMember = scope.chainId === x
export const label = () => {
    switch (family) {
        case 'algorand':
            return 1
        default:
            return 0
    }
}
