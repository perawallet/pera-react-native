import type { Config } from './main'

export const config: Config = {
    mainnetBackendUrl: 'https://mainnet.staging.api.perawallet.app',
    testnetBackendUrl: 'https://testnet.staging.api.perawallet.app',
    mainnetAlgodUrl: 'https://mainnet-api.algonode.cloud',
    testnetAlgodUrl: 'https://testnet-api.algonode.cloud',
    mainnetIndexerUrl: 'http://mainnet-idx.algonode.cloud',
    testnetIndexerUrl: 'http://testnet-idx.algonode.cloud',
    backendAPIKey:
        'development-purposes-only-dc98f2c7-908f-4f74-81ef-9f5464213f99',
    algodApiKey: '',
    indexerApiKey: '',

    discoverBaseUrl: 'https://discover-mobile-staging.perawallet.app/',
    stakingBaseUrl: 'https://staking-mobile-staging.perawallet.app/',

    debugEnabled: true,
    profilingEnabled: false,
}
