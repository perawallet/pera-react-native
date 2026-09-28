import { generateKey } from '@algorandfoundation/keystore'

hoist('a', async importOriginal => {
    const actual =
        await importOriginal<typeof import('some-quite-long-package-name')>()
})

export const after = generateKey
