hoist('a', async importOriginal => {
    const actual =
        await importOriginal<typeof import('some-quite-long-package-name')>()
})

// Tracked in PERA-99
export const after = 1
