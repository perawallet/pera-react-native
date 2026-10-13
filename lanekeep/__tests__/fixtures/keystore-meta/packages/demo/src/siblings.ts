import { openData } from '@algorandfoundation/react-native-keystore'
import type { Key } from '@algorandfoundation/keystore-core'
import { vault } from '@algorandfoundation/keystore-web'

export const all = [openData, vault] as unknown as Key
