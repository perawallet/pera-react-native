import { FalconModule } from '@joe-p/react-native-falcon'
import { Platform } from 'react-native'

export const getFalconModule = () => [FalconModule, Platform]
