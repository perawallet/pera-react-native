import { generateKey } from 'falcon-1024'
import type { Falcon } from '@joe-p/react-native-falcon'
export * from 'falcon-1024/wasm'

export const later = () => import(`falcon-1024`)
export const legacy = () => require('falcon-1024/wasm')
