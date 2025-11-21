import { type Config } from './main'
import {
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE,
    ONE_SECOND,
    THIRTY_SECONDS,
} from './constants'

export const productionConfig: Config = {
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

    notificationRefreshTime: THIRTY_SECONDS,
    remoteConfigRefreshTime: ONE_HOUR,

    reactQueryDefaultGCTime: ONE_HOUR,
    reactQueryDefaultStaleTime: ONE_MINUTE,
    reactQueryShortLivedGCTime: 60 * ONE_DAY,
    reactQueryShortLivedStaleTime: 30 * ONE_SECOND,
    reactQueryPersistenceAge: 60 * ONE_DAY,

    debugEnabled: false,
    profilingEnabled: false,
    pollingEnabled: true,
}
