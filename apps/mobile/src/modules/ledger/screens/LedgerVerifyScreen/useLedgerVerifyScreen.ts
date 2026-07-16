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

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { type RouteProp, useRoute } from '@react-navigation/native'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAccountsStore,
    useSetAccounts,
    useSelectedAccountAddress,
    AccountTypes,
    type LedgerSelectableAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletDerivedAccount,
    HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    verifyLedgerAddress,
    withLedgerConfirmationTimeout,
    withLedgerConnectionTimeout,
    LedgerProviderNotFoundError,
    classifyLedgerError,
} from '@perawallet/wallet-core-ledger'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    generateOrderedUniqueId,
    type AppError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import {
    useExitAccountFlow,
    useShouldPlayConfetti,
} from '@modules/onboarding/hooks'
import {
    getLedgerErrorPreset,
    type LedgerErrorPreset,
} from '@modules/ledger/utils'

type LedgerVerifyRouteProp = RouteProp<AddAccountStackParamList, 'LedgerVerify'>

type UseLedgerVerifyScreenResult = {
    selectedAccounts: ReadonlyArray<LedgerSelectableAccount>
    verifyTargets: ReadonlyArray<HardwareWalletDerivedAccount>
    verifiedIndices: ReadonlySet<number>
    areAllVerified: boolean
    errorPreset: Nullable<LedgerErrorPreset>
    handleAdd: () => void
    handleRetry: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

type VerificationState = 'connecting' | 'verifying' | 'complete' | 'error'

const authAccountOf = (
    s: LedgerSelectableAccount,
): HardwareWalletDerivedAccount =>
    s.kind === 'derived' ? s.account : s.authAccount

export const useLedgerVerifyScreen = (): UseLedgerVerifyScreenResult => {
    const {
        params: {
            deviceId,
            deviceName,
            transportType = 'ble',
            selectedAccounts,
        },
    } = useRoute<LedgerVerifyRouteProp>()
    const { t } = useLanguage()
    const { setAccounts } = useSetAccounts()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { exitAccountFlow } = useExitAccountFlow()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const navigation = useAppNavigation()

    const verifyTargets = useMemo<HardwareWalletDerivedAccount[]>(() => {
        const byIndex = new Map<number, HardwareWalletDerivedAccount>()
        for (const sel of selectedAccounts) {
            const auth = authAccountOf(sel)
            if (!byIndex.has(auth.accountIndex)) {
                byIndex.set(auth.accountIndex, auth)
            }
        }
        return [...byIndex.values()]
    }, [selectedAccounts])

    const [verificationState, setVerificationState] =
        useState<VerificationState>('connecting')
    const [verifiedIndices, setVerifiedIndices] = useState<ReadonlySet<number>>(
        () => new Set(),
    )
    const [error, setError] = useState<Nullable<AppError>>(null)
    const hasStartedRef = useRef(false)

    const verify = useCallback(async () => {
        let transport: Nullable<HardwareWalletTransport> = null
        try {
            setVerificationState('connecting')
            setError(null)
            setVerifiedIndices(new Set())

            const provider = getProvider().hardwareWalletRegistry.getProvider(
                'ledger',
                transportType,
            )
            if (!provider) {
                throw new LedgerProviderNotFoundError(
                    `No Ledger provider registered for transport "${transportType}"`,
                )
            }

            const connectPromise = provider.connect(deviceId)
            try {
                transport = await withLedgerConnectionTimeout(
                    connectPromise,
                    'Connect to Ledger',
                )
            } catch (connectError) {
                // A transport arriving after the timeout would hold the BLE
                // link (the finally below only sees a null transport).
                connectPromise
                    .then(t => t.disconnect().catch(() => {}))
                    .catch(() => {})
                throw connectError
            }
            setVerificationState('verifying')

            for (let i = 0; i < verifyTargets.length; i++) {
                // A silent BLE drop mid-verify otherwise leaves the screen
                // in `verifying` forever — the confirmation ceiling turns it
                // into a retryable error.
                await withLedgerConfirmationTimeout(
                    verifyLedgerAddress(
                        transport,
                        verifyTargets[i].accountIndex,
                    ),
                    'Verify Ledger address',
                )
                setVerifiedIndices(prev => {
                    const next = new Set(prev)
                    next.add(i)
                    return next
                })
            }

            setVerificationState('complete')
        } catch (err) {
            const verifyError = classifyLedgerError(err)
            setError(verifyError)
            setVerificationState('error')
        } finally {
            if (transport) {
                await transport.disconnect().catch(() => {})
            }
        }
    }, [deviceId, transportType, verifyTargets])

    // Run verify once on mount. The ref guards against React StrictMode's
    // dev-only double-invoke (a second call would race the first against a
    // different transport instance). Route params are stable for the screen's
    // lifetime, so an empty dep array is intentional.
    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true
        void verify()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleAdd = useCallback(() => {
        const current = useAccountsStore.getState().accounts
        const existing = new Set(current.map(a => a.address))
        const added = new Set<string>()
        const batch: WalletAccount[] = []

        const addHardware = (acc: HardwareWalletDerivedAccount) => {
            if (!isValidAlgorandAddress(acc.address)) return
            if (existing.has(acc.address) || added.has(acc.address)) return
            added.add(acc.address)
            batch.push({
                id: generateOrderedUniqueId(),
                type: AccountTypes.hardware,
                address: acc.address,
                hardwareDetails: {
                    manufacturer: 'ledger' as const,
                    deviceId,
                    deviceName,
                    accountIndex: acc.accountIndex,
                    transportType,
                },
            })
        }

        for (const sel of selectedAccounts) {
            if (sel.kind === 'derived') {
                addHardware(sel.account)
            } else {
                addHardware(sel.authAccount)
                const authPresent =
                    added.has(sel.authAccount.address) ||
                    existing.has(sel.authAccount.address)
                if (
                    authPresent &&
                    isValidAlgorandAddress(sel.address) &&
                    !existing.has(sel.address) &&
                    !added.has(sel.address)
                ) {
                    added.add(sel.address)
                    // Every account carries a unique `id`; dedup within this
                    // import still keys on `address` (see `addHardware` above)
                    // because all account kinds today are on-chain.
                    batch.push({
                        id: generateOrderedUniqueId(),
                        type: AccountTypes.watch,
                        address: sel.address,
                        rekeyAddress: sel.authAccount.address,
                    })
                }
            }
        }

        if (batch.length === 0) {
            exitAccountFlow()
            return
        }

        setAccounts([...current, ...batch])

        const firstDerived = selectedAccounts.find(s => s.kind === 'derived')
        const selectedAddress = firstDerived
            ? firstDerived.account.address
            : batch[0].address
        setSelectedAccountAddress(selectedAddress)
        setShouldPlayConfetti(true)
        exitAccountFlow()
    }, [
        deviceId,
        deviceName,
        transportType,
        selectedAccounts,
        setAccounts,
        setSelectedAccountAddress,
        setShouldPlayConfetti,
        exitAccountFlow,
    ])

    const handleRetry = useCallback(() => {
        void verify()
    }, [verify])

    const handleTroubleshoot = useCallback(() => {
        navigation.navigate('LedgerTroubleshooting')
    }, [navigation])

    const errorPreset = useMemo(
        () =>
            verificationState === 'error' && error !== null
                ? getLedgerErrorPreset(error, t)
                : null,
        [error, verificationState, t],
    )

    const areAllVerified =
        verifyTargets.length > 0 &&
        verifiedIndices.size === verifyTargets.length

    return {
        selectedAccounts,
        verifyTargets,
        verifiedIndices,
        areAllVerified,
        errorPreset,
        handleAdd,
        handleRetry,
        handleTroubleshoot,
        t,
    }
}
