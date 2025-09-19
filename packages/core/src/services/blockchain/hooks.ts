import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useAppStore } from '../../store'
import { Networks } from './types'

export const useAlgorandClient = () => {
    const network = useAppStore(state => state.network)

    if (network === Networks.testnet) {
        return AlgorandClient.testNet()
    } else if (network === Networks.mainnet) {
        return AlgorandClient.mainNet()
    }

    return AlgorandClient.fromEnvironment()
}
