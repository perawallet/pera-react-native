import { toByteArray, fromByteArray } from 'base64-js'

export const encodeToBase64 = (bytes: Uint8Array) => {
	return fromByteArray(bytes)
}

export const decodeFromBase64 = (base64: string) => {
	return toByteArray(base64)
}
