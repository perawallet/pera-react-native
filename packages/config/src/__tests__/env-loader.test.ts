/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadEnvOverrides, getConfigWithEnvOverrides } from '../env-loader'
import { type Config, overrideEnvironmentMap } from '../main'

describe('env-loader', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
        originalEnv = { ...process.env }
        // Clear all env variables before each test
        Object.keys(process.env).forEach(key => {
            if (
                overrideEnvironmentMap.hasOwnProperty(key) ||
                Object.values(overrideEnvironmentMap).includes(key)
            ) {
                delete process.env[key]
            }
        })
    })

    afterEach(() => {
        process.env = originalEnv
        vi.restoreAllMocks()
    })

    describe('loadEnvOverrides', () => {
        test('returns empty object when no environment variables are set', () => {
            const result = loadEnvOverrides()
            expect(result).toEqual({})
        })

        test('loads mainnetBackendUrl from MAINNET_BACKEND_URL', () => {
            process.env.MAINNET_BACKEND_URL =
                'https://custom-mainnet.example.com'
            const result = loadEnvOverrides()
            expect(result.mainnetBackendUrl).toBe(
                'https://custom-mainnet.example.com',
            )
        })

        test('loads testnetBackendUrl from TESTNET_BACKEND_URL', () => {
            process.env.TESTNET_BACKEND_URL =
                'https://custom-testnet.example.com'
            const result = loadEnvOverrides()
            expect(result.testnetBackendUrl).toBe(
                'https://custom-testnet.example.com',
            )
        })

        test('loads backendAPIKey from BACKEND_API_KEY', () => {
            process.env.BACKEND_API_KEY = 'test-api-key-123'
            const result = loadEnvOverrides()
            expect(result.backendAPIKey).toBe('test-api-key-123')
        })

        test('loads algodApiKey from ALGOD_API_KEY', () => {
            process.env.ALGOD_API_KEY = 'test-algod-key-456'
            const result = loadEnvOverrides()
            expect(result.algodApiKey).toBe('test-algod-key-456')
        })

        test('loads indexerApiKey from INDEXER_API_KEY', () => {
            process.env.INDEXER_API_KEY = 'test-indexer-key-789'
            const result = loadEnvOverrides()
            expect(result.indexerApiKey).toBe('test-indexer-key-789')
        })

        test('loads mainnetAlgodUrl from MAINNET_ALGOD_URL', () => {
            process.env.MAINNET_ALGOD_URL =
                'https://custom-mainnet-algod.example.com'
            const result = loadEnvOverrides()
            expect(result.mainnetAlgodUrl).toBe(
                'https://custom-mainnet-algod.example.com',
            )
        })

        test('loads testnetAlgodUrl from TESTNET_ALGOD_URL', () => {
            process.env.TESTNET_ALGOD_URL =
                'https://custom-testnet-algod.example.com'
            const result = loadEnvOverrides()
            expect(result.testnetAlgodUrl).toBe(
                'https://custom-testnet-algod.example.com',
            )
        })

        test('loads mainnetIndexerUrl from MAINNET_INDEXER_URL', () => {
            process.env.MAINNET_INDEXER_URL =
                'https://custom-mainnet-indexer.example.com'
            const result = loadEnvOverrides()
            expect(result.mainnetIndexerUrl).toBe(
                'https://custom-mainnet-indexer.example.com',
            )
        })

        test('loads testnetIndexerUrl from TESTNET_INDEXER_URL', () => {
            process.env.TESTNET_INDEXER_URL =
                'https://custom-testnet-indexer.example.com'
            const result = loadEnvOverrides()
            expect(result.testnetIndexerUrl).toBe(
                'https://custom-testnet-indexer.example.com',
            )
        })

        test('parses debugEnabled as true when DEBUG_ENABLED is "true"', () => {
            process.env.DEBUG_ENABLED = 'true'
            const result = loadEnvOverrides()
            expect(result.debugEnabled).toBe(true)
        })

        test('parses debugEnabled as false when DEBUG_ENABLED is "false"', () => {
            process.env.DEBUG_ENABLED = 'false'
            const result = loadEnvOverrides()
            expect(result.debugEnabled).toBe(false)
        })

        test('parses debugEnabled as false when DEBUG_ENABLED is any other value', () => {
            process.env.DEBUG_ENABLED = 'yes'
            const result = loadEnvOverrides()
            expect(result.debugEnabled).toBe(false)
        })

        test('parses profilingEnabled as true when PROFILING_ENABLED is "true"', () => {
            process.env.PROFILING_ENABLED = 'true'
            const result = loadEnvOverrides()
            expect(result.profilingEnabled).toBe(true)
        })

        test('parses profilingEnabled as false when PROFILING_ENABLED is "false"', () => {
            process.env.PROFILING_ENABLED = 'false'
            const result = loadEnvOverrides()
            expect(result.profilingEnabled).toBe(false)
        })

        test('parses pollingEnabled as true when POLLING_ENABLED is "true"', () => {
            process.env.POLLING_ENABLED = 'true'
            const result = loadEnvOverrides()
            expect(result.pollingEnabled).toBe(true)
        })

        test('parses pollingEnabled as false when POLLING_ENABLED is "false"', () => {
            process.env.POLLING_ENABLED = 'false'
            const result = loadEnvOverrides()
            expect(result.pollingEnabled).toBe(false)
        })

        test('parses disableScreenCapturePrevention as true when DISABLE_SCREEN_CAPTURE_PREVENTION is "true"', () => {
            process.env.DISABLE_SCREEN_CAPTURE_PREVENTION = 'true'
            const result = loadEnvOverrides()
            expect(result.disableScreenCapturePrevention).toBe(true)
        })

        test('parses disableScreenCapturePrevention as false when DISABLE_SCREEN_CAPTURE_PREVENTION is any other value', () => {
            process.env.DISABLE_SCREEN_CAPTURE_PREVENTION = 'yes'
            const result = loadEnvOverrides()
            expect(result.disableScreenCapturePrevention).toBe(false)
        })

        test('loads defaultNetwork from DEFAULT_NETWORK', () => {
            process.env.DEFAULT_NETWORK = 'testnet'
            const result = loadEnvOverrides()
            expect(result.defaultNetwork).toBe('testnet')
        })

        test('loads multiple environment variables at once', () => {
            process.env.MAINNET_BACKEND_URL =
                'https://custom-mainnet.example.com'
            process.env.BACKEND_API_KEY = 'test-api-key-123'
            process.env.DEBUG_ENABLED = 'true'
            process.env.MAINNET_ALGOD_URL = 'https://custom-algod.example.com'

            const result = loadEnvOverrides()

            expect(result).toEqual({
                mainnetBackendUrl: 'https://custom-mainnet.example.com',
                backendAPIKey: 'test-api-key-123',
                debugEnabled: true,
                mainnetAlgodUrl: 'https://custom-algod.example.com',
            })
        })

        test('loads all possible environment variables', () => {
            process.env.MAINNET_BACKEND_URL =
                'https://mainnet-backend.example.com'
            process.env.TESTNET_BACKEND_URL =
                'https://testnet-backend.example.com'
            process.env.BACKEND_API_KEY = 'backend-key'
            process.env.ALGOD_API_KEY = 'algod-key'
            process.env.INDEXER_API_KEY = 'indexer-key'
            process.env.MAINNET_ALGOD_URL = 'https://mainnet-algod.example.com'
            process.env.TESTNET_ALGOD_URL = 'https://testnet-algod.example.com'
            process.env.MAINNET_INDEXER_URL =
                'https://mainnet-indexer.example.com'
            process.env.TESTNET_INDEXER_URL =
                'https://testnet-indexer.example.com'
            process.env.DEBUG_ENABLED = 'true'
            process.env.PROFILING_ENABLED = 'false'
            process.env.POLLING_ENABLED = 'true'

            const result = loadEnvOverrides()

            expect(result).toEqual({
                mainnetBackendUrl: 'https://mainnet-backend.example.com',
                testnetBackendUrl: 'https://testnet-backend.example.com',
                backendAPIKey: 'backend-key',
                algodApiKey: 'algod-key',
                indexerApiKey: 'indexer-key',
                mainnetAlgodUrl: 'https://mainnet-algod.example.com',
                testnetAlgodUrl: 'https://testnet-algod.example.com',
                mainnetIndexerUrl: 'https://mainnet-indexer.example.com',
                testnetIndexerUrl: 'https://testnet-indexer.example.com',
                debugEnabled: true,
                profilingEnabled: false,
                pollingEnabled: true,
            })
        })

        test('ignores unrelated environment variables', () => {
            process.env.OTHER_VAR = 'should-be-ignored'
            process.env.PERA = 'also-ignored'
            process.env.BACKEND_URL = 'ignored-too'

            const result = loadEnvOverrides()
            expect(result).toEqual({})
        })

        test('handles empty string values for URLs', () => {
            process.env.MAINNET_BACKEND_URL = ''
            const result = loadEnvOverrides()
            expect(result.mainnetBackendUrl).toBeUndefined()
        })

        test('handles empty string values for API keys', () => {
            process.env.BACKEND_API_KEY = ''
            const result = loadEnvOverrides()
            expect(result.backendAPIKey).toBeUndefined()
        })
    })

    describe('getConfigWithEnvOverrides', () => {
        const mockBaseConfig: Config = {
            mainnetBackendUrl: 'https://base-mainnet.example.com',
            testnetBackendUrl: 'https://base-testnet.example.com',
            mainnetAlgodUrl: 'https://base-mainnet-algod.example.com',
            testnetAlgodUrl: 'https://base-testnet-algod.example.com',
            mainnetIndexerUrl: 'https://base-mainnet-indexer.example.com',
            testnetIndexerUrl: 'https://base-testnet-indexer.example.com',
            mainnetGenesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
            testnetGenesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
            backendAPIKey: 'base-backend-key',
            algodApiKey: 'base-algod-key',
            indexerApiKey: 'base-indexer-key',
            appStoreAppID: 'base-app-store-id',
            playIntegrityCloudProjectNumber:
                'base-play-integrity-project-number',
            firebaseApiKey: 'base-firebase-api-key',
            firebaseAuthDomain: 'base.firebaseapp.com',
            firebaseDatabaseUrl: 'https://base.firebaseio.com',
            firebaseProjectId: 'base-project',
            firebaseStorageBucket: 'base.firebasestorage.app',
            firebaseMessagingSenderId: 'base-sender-id',
            firebaseAppId: 'base-app-id',
            firebaseMeasurementId: 'G-BASE',
            gaMeasurementApiSecret: 'base-ga-secret',
            sentryDsn: 'https://base@o0.ingest.sentry.io/0',
            mainnetExplorerUrl: 'https://explorer.example.com',
            testnetExplorerUrl: 'https://testnet-explorer.example.com',
            notificationRefreshTime: 30000,
            remoteConfigRefreshTime: 3600000,
            algodReadTimeout: 10000,
            algodSubmitTimeout: 30000,
            signingTransportTimeout: 35000,
            reactQueryDefaultGCTime: 3600000,
            reactQueryDefaultStaleTime: 60000,
            reactQueryShortLivedGCTime: 86400000,
            reactQueryShortLivedStaleTime: 30000,
            reactQueryLongLivedGCTime: 1814400000,
            reactQueryLongLivedStaleTime: 604800000,
            reactQueryPersistenceAge: 5184000000,
            discoverBaseUrl: 'https://discover.example.com',
            onrampSupportEmail: 'support@xoswap.example.com',
            cardSupportEmail: 'support@baanx.example.com',
            supportBaseUrl: 'https://support.example.com',
            mainnetBidaliApiKey: 'test-mainnet-bidali-key',
            testnetBidaliApiKey: 'test-testnet-bidali-key',
            mainnetBidaliBaseUrl: 'https://commerce.bidali.example.com/dapp',
            testnetBidaliBaseUrl:
                'https://commerce.staging.bidali.example.com/dapp',
            mainnetBaanxBaseUrl: 'https://api.baanx.example.com',
            testnetBaanxBaseUrl: 'https://dev.api.baanx.example.com',
            mainnetBaanxClientKey: 'test-mainnet-baanx-key',
            testnetBaanxClientKey: 'test-testnet-baanx-key',
            mainnetBaanxTenantId: 'test-mainnet-baanx-tenant',
            testnetBaanxTenantId: 'test-testnet-baanx-tenant',
            termsOfServiceUrl: 'https://terms.example.com',
            privacyPolicyUrl: 'https://privacy.example.com',
            peraDemoDappUrl: 'https://demo.example.com',
            sendFundsFaqUrl: 'https://faq.example.com',
            assetInboxSupportUrl: 'https://asset-inbox-support.example.com',
            swapSupportUrl: 'https://swap-support.example.com',
            multisigSupportUrl: 'https://multisig-support.example.com',
            dispenserUrl: 'https://dispenser.example.com',
            algorandDefiUrl: 'https://defi.example.com',
            asaVerificationUrl: 'https://asa-verification.example.com',
            accountTypeSupportUrl: 'https://account-type-support.example.com',
            ledgerAccountSupportUrl:
                'https://ledger-account-support.example.com',
            recoveryPassphraseSupportUrl:
                'https://recovery-passphrase-support.example.com',
            watchAccountSupportUrl: 'https://watch-account-support.example.com',
            rekeyToStandardSupportUrl:
                'https://rekey-to-standard-support.example.com',
            rekeyToSharedSupportUrl:
                'https://rekey-to-shared-support.example.com',
            rekeyToLedgerSupportUrl:
                'https://rekey-to-ledger-support.example.com',
            undoRekeySupportUrl: 'https://undo-rekey-support.example.com',
            peraCardLearnMoreUrl: 'https://pera-card-learn-more.example.com',
            debugEnabled: false,
            profilingEnabled: false,
            pollingEnabled: true,
            disableScreenCapturePrevention: false,
            arc59: {
                testnet: {
                    appId: 643020148n,
                    appAddress:
                        'YIIC6GF4DUJYZTYTZ5UEOAXONUUKZRDFOTV4EKSGD5E7BYE6EE3IVPYEDQ',
                },
                mainnet: {
                    appId: 2449590623n,
                    appAddress:
                        'EZRVNZFJGOUZC67FUMEC7ZMVP232TPICFTQCVZ6EQEIRRT3TIHSKZULRNI',
                },
            },
            defaultNetwork: 'mainnet',
            appEnvironment: 'development',
            releaseTag: '',
            appBuildNumber: '',
        }

        test('returns base config when no environment variables are set', () => {
            const result = getConfigWithEnvOverrides(mockBaseConfig)
            expect(result).toEqual(mockBaseConfig)
        })

        test('merges environment overrides with base config', () => {
            process.env.MAINNET_BACKEND_URL = 'https://env-mainnet.example.com'
            process.env.BACKEND_API_KEY = 'env-backend-key'

            const result = getConfigWithEnvOverrides(mockBaseConfig)

            expect(result.mainnetBackendUrl).toBe(
                'https://env-mainnet.example.com',
            )
            expect(result.backendAPIKey).toBe('env-backend-key')
            expect(result.testnetBackendUrl).toBe(
                mockBaseConfig.testnetBackendUrl,
            )
        })

        test('overrides boolean flags correctly', () => {
            process.env.DEBUG_ENABLED = 'true'
            process.env.PROFILING_ENABLED = 'true'
            process.env.POLLING_ENABLED = 'false'
            process.env.DISABLE_SCREEN_CAPTURE_PREVENTION = 'true'

            const result = getConfigWithEnvOverrides(mockBaseConfig)

            expect(result.debugEnabled).toBe(true)
            expect(result.profilingEnabled).toBe(true)
            expect(result.pollingEnabled).toBe(false)
            expect(result.disableScreenCapturePrevention).toBe(true)
        })

        test('validates merged config against schema', () => {
            process.env.MAINNET_BACKEND_URL = 'https://valid-url.example.com'

            const result = getConfigWithEnvOverrides(mockBaseConfig)

            expect(result.mainnetBackendUrl).toBe(
                'https://valid-url.example.com',
            )
            expect(() => result).not.toThrow()
        })

        test('throws error when merged config has invalid URL', () => {
            const invalidConfig = { ...mockBaseConfig }
            process.env.MAINNET_BACKEND_URL = 'not-a-valid-url'

            expect(() => getConfigWithEnvOverrides(invalidConfig)).toThrow(
                'Invalid configuration after applying environment variables',
            )
        })

        test('logs error and throws when validation fails', () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})

            process.env.MAINNET_BACKEND_URL = 'invalid-url'

            expect(() => getConfigWithEnvOverrides(mockBaseConfig)).toThrow()
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Configuration validation failed with env overrides:',
                expect.anything(),
            )

            consoleErrorSpy.mockRestore()
        })

        test('preserves all base config properties when only some are overridden', () => {
            process.env.BACKEND_API_KEY = 'new-api-key'

            const result = getConfigWithEnvOverrides(mockBaseConfig)

            expect(result.backendAPIKey).toBe('new-api-key')
            expect(result.mainnetBackendUrl).toBe(
                mockBaseConfig.mainnetBackendUrl,
            )
            expect(result.testnetBackendUrl).toBe(
                mockBaseConfig.testnetBackendUrl,
            )
            expect(result.mainnetExplorerUrl).toBe(
                mockBaseConfig.mainnetExplorerUrl,
            )
            expect(result.notificationRefreshTime).toBe(
                mockBaseConfig.notificationRefreshTime,
            )
        })

        test('handles multiple overrides without losing data', () => {
            process.env.MAINNET_BACKEND_URL = 'https://new-mainnet.example.com'
            process.env.TESTNET_BACKEND_URL = 'https://new-testnet.example.com'
            process.env.BACKEND_API_KEY = 'new-backend-key'
            process.env.ALGOD_API_KEY = 'new-algod-key'
            process.env.DEBUG_ENABLED = 'true'

            const result = getConfigWithEnvOverrides(mockBaseConfig)

            expect(result).toEqual({
                ...mockBaseConfig,
                mainnetBackendUrl: 'https://new-mainnet.example.com',
                testnetBackendUrl: 'https://new-testnet.example.com',
                backendAPIKey: 'new-backend-key',
                algodApiKey: 'new-algod-key',
                debugEnabled: true,
                defaultNetwork: 'mainnet',
            })
        })
    })
})
