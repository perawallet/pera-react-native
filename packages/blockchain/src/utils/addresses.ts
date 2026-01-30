import { encodeAddress } from '@algorandfoundation/algokit-utils'

export const encodeAlgorandAddress = (bytes: Uint8Array): string => {
    return encodeAddress(bytes)
}

export const isValidAlgorandAddress = (address?: string) => {
    if (!address) {
        return false
    }
    return /^[0-9a-zA-Z]{58}$/.test(address)
}
