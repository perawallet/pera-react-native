declare const scope: { chainId: string }
declare const account: { family: string }
declare const x: string
declare const a: number
declare const b: number

export const branch = () => {
    switch (scope.chainId) {
        default:
            return 0
    }
}
export const family = () => {
    if (account.family === x) return 1
    return 0
}
export const t = x !== scope.chainId ? a : b
export const d = 'algorand'
export const ids = ['algorand']
export type Ref = { kind: 'algorand' }
