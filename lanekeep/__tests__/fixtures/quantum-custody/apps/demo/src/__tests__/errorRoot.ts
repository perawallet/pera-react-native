export const old = 'signWithQuantumSeed'

hoist('a', async importOriginal => {
    const actual =
        await importOriginal<typeof import('some-quite-long-package-name')>()
})

export const after = 1
