import { encodeAlgorandAddress } from './addresses'

export const algorandSafeJsonStringify = (value: unknown) => {
    return JSON.stringify(
        value,
        (key, value) => {
            if (key === 'publicKey') {
                return encodeAlgorandAddress(value)
            }
            if (typeof value === 'bigint') {
                if (value > Number.MAX_SAFE_INTEGER) {
                    return value.toString()
                }
                return Number(value)
            }
            if (value instanceof Uint8Array) {
                return Buffer.from(value).toString('base64')
            }
            return value
        },
        4,
    )
}
