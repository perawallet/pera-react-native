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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { networkListOf } from '@modules/chain-ui'
import {
    type RouteProp,
    useNavigation,
    useRoute,
} from '@react-navigation/native'
import {
    chainAccountOf,
    hasCustody,
    hdIndexOf,
    signingKeyOn,
    useHDImportSession,
    useSelectedAccountId,
    type WalletDiscoveryProgress,
} from '@perawallet/wallet-core-accounts'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { type ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import type { OnboardingStackParamList } from '../../routes/types'
import {
    useDelegationScanNoticeResult,
    REKEY_SCAN_UNAVAILABLE,
} from '../../hooks'
import { useHdWalletRescan } from './useHdWalletRescan'

export type ScanNetworkStatus = 'checking' | 'failed' | 'unavailable'

const scanNetworkStatusOf = (
    progress: Optional<WalletDiscoveryProgress>,
    chainId: ChainId,
): ScanNetworkStatus => {
    if (progress?.refusedChainIds.includes(chainId)) return 'unavailable'
    if (progress?.failedChainIds.includes(chainId)) return 'failed'
    return 'checking'
}

export type ScanNetwork = {
    chainId: ChainId
    name: string
    status: ScanNetworkStatus
}

export type UseSearchAccountsScreenResult = {
    t: (key: string) => string
    dotOpacities: Animated.Value[]
    /** Undefined until a wallet rescan reports, and for every other search. */
    progressLabel: Optional<string>
    networks: ScanNetwork[]
    canCancel: boolean
    isCancelling: boolean
    handleCancel: () => void
}

const DOT_COUNT = 4
const ANIMATION_DURATION = 400
const STEP_DURATION = 500
const TRANSPARENT_OPACITY = 0.3
const FULL_OPACITY = 1

export function useSearchAccountsScreen(): UseSearchAccountsScreenResult {
    const route =
        useRoute<RouteProp<OnboardingStackParamList, 'SearchAccounts'>>()
    const params = route.params
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const navigation = useAppNavigation()
    const reactNavigation = useNavigation()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const { discoverImportAccounts, cancelImport } = useHDImportSession(scope)
    const { scanRekeyed } = useDelegationScanNoticeResult()
    const { rescanHdWallet } = useHdWalletRescan()
    const { setSelectedAccountId } = useSelectedAccountId()

    const dotOpacities = useRef(
        Array.from(
            { length: DOT_COUNT },
            () => new Animated.Value(FULL_OPACITY),
        ),
    ).current

    useEffect(() => {
        let currentIndex = 0

        dotOpacities[0].setValue(TRANSPARENT_OPACITY)

        const interval = setInterval(() => {
            const prevIndex = currentIndex
            currentIndex = (currentIndex + 1) % DOT_COUNT

            Animated.parallel([
                Animated.timing(dotOpacities[prevIndex], {
                    toValue: FULL_OPACITY,
                    duration: ANIMATION_DURATION,
                    useNativeDriver: true,
                }),
                Animated.timing(dotOpacities[currentIndex], {
                    toValue: TRANSPARENT_OPACITY,
                    duration: ANIMATION_DURATION,
                    useNativeDriver: true,
                }),
            ]).start()
        }, STEP_DURATION)

        return () => clearInterval(interval)
    }, [dotOpacities])

    const hasSearched = useRef(false)
    const isImportMode = 'mode' in params && params.mode === 'import'
    const isSearchingImportRef = useRef(false)
    // Read by the failure path: when nothing could be offered, the networks
    // that couldn't be checked are why.
    const uncheckedChainIdsRef = useRef<ChainId[]>([])
    const hasLeftRef = useRef(false)
    const [searchAbort] = useState(() => new AbortController())
    const [progress, setProgress] = useState<WalletDiscoveryProgress>()
    const [isCancelling, setIsCancelling] = useState(false)

    // The select screen's own listener isn't mounted yet. Leaving a rescan
    // stops its walk, as Cancel does, and keeps what it found.
    useEffect(
        () =>
            reactNavigation.addListener('beforeRemove', () => {
                if (isImportMode) {
                    if (!isSearchingImportRef.current) return
                    hasLeftRef.current = true
                    searchAbort.abort()
                    cancelImport()
                    return
                }
                hasLeftRef.current = true
                searchAbort.abort()
            }),
        [isImportMode, reactNavigation, cancelImport, searchAbort],
    )

    const handleCancel = useCallback(() => {
        setIsCancelling(true)
        searchAbort.abort()
    }, [searchAbort])

    const searchAccounts = useCallback(async () => {
        if (hasSearched.current) return
        hasSearched.current = true

        try {
            // Import mode: always navigate to the selection screen so the user
            // picks the account(s) to import.
            if ('mode' in params && params.mode === 'import') {
                isSearchingImportRef.current = true
                const {
                    accounts: discovered,
                    failedChainIds,
                    isOriginFallback,
                } = await discoverImportAccounts({
                    walletKeyId: params.walletKeyId,
                    signal: searchAbort.signal,
                    onProgress: setProgress,
                    previous: params.previous,
                })
                isSearchingImportRef.current = false
                if (hasLeftRef.current) return
                uncheckedChainIdsRef.current = failedChainIds
                if (discovered.length === 0) {
                    throw new Error('HD discovery returned no accounts')
                }
                navigation.replace('ImportSelectAddresses', {
                    mode: 'import',
                    walletKeyId: params.walletKeyId,
                    accounts: discovered,
                    failedChainIds,
                    isOriginFallback,
                })
                return
            }

            // Existing mode: `params` is the variant the import branch above
            // ruled out.
            const { account, chainIds } = params as Extract<
                typeof params,
                { account: unknown }
            >
            if (hdIndexOf(account) !== undefined) {
                await rescanHdWallet(account, {
                    chainIds,
                    signal: searchAbort.signal,
                    onProgress: setProgress,
                    hasLeft: () => hasLeftRef.current,
                })
                return
            }

            if (!signingKeyOn(account, scope.chainId)) return
            const accountAddress =
                chainAccountOf(account, scope.chainId)?.address ?? ''

            if (hasCustody(account, 'local')) {
                // Quantum accounts are flat single-key accounts like algo25:
                // discovery is an address-only rekey scan (no derivation), and
                // an empty result must still move the flow on to NameAccount —
                // otherwise the "Searching your accounts" step hangs forever.
                const discoveredRekeyedAccounts = await scanRekeyed([
                    accountAddress,
                ])

                // A scan we couldn't run is not a failed import — the account
                // is already committed. Name it and let the user rescan later.
                if (
                    discoveredRekeyedAccounts === REKEY_SCAN_UNAVAILABLE ||
                    discoveredRekeyedAccounts.length === 0
                ) {
                    // Let the user name the imported account before finishing;
                    // NameAccount selects it, plays the confetti and exits the
                    // flow on confirm.
                    navigation.replace('NameAccount', { account })
                } else {
                    setSelectedAccountId(account.id)
                    navigation.replace('ImportRekeyedAddresses', {
                        accounts: discoveredRekeyedAccounts,
                        hasImportedAccounts: true,
                    })
                }
            }
        } catch (error) {
            isSearchingImportRef.current = false
            if (hasLeftRef.current) return
            logger.error('Failed during scan-new-addresses', { error })
            // In import mode, abandon the in-memory session so we don't leak
            // root key material if the user retries.
            if ('mode' in params && params.mode === 'import') {
                cancelImport()
            }
            // Not showError: an unrecognised error would fall through to generic copy instead of this step's.
            const unchecked = uncheckedChainIdsRef.current
            errorToast(
                t('onboarding.import_account.failed_title'),
                unchecked.length > 0
                    ? t('onboarding.import_account.failed_networks_body', {
                          networks: networkListOf(unchecked, t),
                      })
                    : t('onboarding.import_account.failed_body'),
            )
            navigation.goBack()
        }
    }, [
        params,
        discoverImportAccounts,
        cancelImport,
        rescanHdWallet,
        scanRekeyed,
        navigation,
        t,
        errorToast,
        setSelectedAccountId,
        scope.chainId,
        searchAbort,
    ])

    useEffect(() => {
        void searchAccounts()
    }, [searchAccounts])

    const networks = useMemo<ScanNetwork[]>(
        () =>
            (progress?.chainIds ?? []).map(chainId => ({
                chainId,
                name: chainDisplayNameOf(chainId) ?? chainId,
                status: scanNetworkStatusOf(progress, chainId),
            })),
        [progress],
    )

    const progressLabel = useMemo(() => {
        if (!progress?.checkedAccountCount) return undefined
        const checked = t('onboarding.searching_accounts.checked_accounts', {
            count: progress.checkedAccountCount,
        })
        return progress.foundCount > 0
            ? `${checked} · ${t('onboarding.searching_accounts.new_found', {
                  count: progress.foundCount,
              })}`
            : checked
    }, [progress, t])

    return {
        t,
        dotOpacities,
        progressLabel,
        networks,
        canCancel: !isImportMode && progress !== undefined,
        isCancelling,
        handleCancel,
    }
}
