import { encodeAddress } from 'algosdk'

export const encodeAlgorandAddress = (bytes: Uint8Array): string => {
	return encodeAddress(bytes)
}
