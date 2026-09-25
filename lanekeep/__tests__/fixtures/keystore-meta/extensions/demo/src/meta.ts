import { generateKey } from '@algorandfoundation/keystore'
import type { Key } from '@algorandfoundation/keystore/types'

export const load = () => import('@algorandfoundation/keystore/errors')
export const legacy = () => require('@algorandfoundation/keystore')
export type T = typeof import('@algorandfoundation/keystore')
export type K = import('@algorandfoundation/keystore').Key
