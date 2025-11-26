import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useMemo } from 'react'
import { Networks } from '../../../shared/src'
import { config } from '@perawallet/wallet-core-config'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

export const useAlgorandClient = () => {
    const { network } = useNetwork()

    return useMemo(() => {
        const isMainnet = network === Networks.mainnet
        const algodConfig = {
            server: isMainnet ? config.mainnetAlgodUrl : config.testnetAlgodUrl,
            token: config.algodApiKey,
        }
        const indexerConfig = {
            server: isMainnet
                ? config.mainnetIndexerUrl
                : config.testnetIndexerUrl,
            token: config.algodApiKey,
        }
        return AlgorandClient.fromConfig({ algodConfig, indexerConfig })
    }, [network])
}
