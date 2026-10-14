import { Networks } from '@perawallet/wallet-core-config'
import { sign } from '@algorandfoundation/algokit-utils'

// Reads the rekey flag Pera 6 stored.
export const rekeySupport = Networks.mainnet

export const flag = 'arc59ExpressSendWarningEnabled'

export const fileKind = `asb-${flag}`

export class AsbImportError extends Error {}

export const useNetworks = () => sign

export const ALGORAND_SIGN_PREFIX = 'MX'

export const onRekey = () => sign
