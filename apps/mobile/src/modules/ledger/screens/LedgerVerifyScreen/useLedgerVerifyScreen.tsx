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
    type HardwareWalletDetails,
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
    LedgerAddressMismatchError,
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
import { useBottomSheet } from '@modules/bottom-sheet'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import {
    useExitAccountFlow,
    useShouldPlayConfetti,
} from '@modules/onboarding/hooks'
import {
    deserializeSelectableAccount,
    getLedgerErrorPreset,
    type LedgerErrorPreset,
} from '@modules/ledger/utils'
import { WatchAccountUpgradeSheet } from '@modules/ledger/components/WatchAccountUpgradeSheet'

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
            selectedAccounts: serializedSelectedAccounts,
        },
    } = useRoute<LedgerVerifyRouteProp>()
    const selectedAccounts = useMemo(
        () => serializedSelectedAccounts.map(deserializeSelectableAccount),
        [serializedSelectedAccounts],
    )
    const { t } = useLanguage()
    const { setAccounts } = useSetAccounts()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { exitAccountFlow } = useExitAccountFlow()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { request: requestBottomSheet } = useBottomSheet()
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
                const verified = await withLedgerConfirmationTimeout(
                    verifyLedgerAddress(
                        transport,
                        verifyTargets[i].accountIndex,
                    ),
                    'Verify Ledger address',
                )
                // A seed swapped between fetch and verify derives a different
                // address at the same index; sign-time would reject it anyway
                // (createHardwareStrategy), so fail here before an unsignable
                // account can be written.
                if (verified.address !== verifyTargets[i].address) {
                    throw new LedgerAddressMismatchError(
                        verifyTargets[i].address,
                        verified.address,
                    )
                }
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

    const runAdd = useCallback(async () => {
        const current = useAccountsStore.getState().accounts
        const byAddress = new Map(current.map(a => [a.address, a]))
        const added = new Set<string>()
        const batch: WalletAccount[] = []
        const upgrades: Array<{
            address: string
            details: HardwareWalletDetails
        }> = []
        const rebinds: Array<{
            address: string
            details: HardwareWalletDetails
        }> = []

        // Default names number on from the ledger accounts already in the
        // wallet ("Ledger 3" after two prior imports) — count-based, so
        // renames/removals can repeat a number; names are not unique.
        let nextDefaultNameNumber =
            current.filter(
                a =>
                    a.type === AccountTypes.hardware &&
                    a.hardwareDetails.manufacturer === 'ledger',
            ).length + 1

        const detailsFor = (
            acc: HardwareWalletDerivedAccount,
        ): HardwareWalletDetails => ({
            manufacturer: 'ledger' as const,
            deviceId,
            deviceName,
            accountIndex: acc.accountIndex,
            transportType,
        })

        const addHardware = (acc: HardwareWalletDerivedAccount) => {
            if (!isValidAlgorandAddress(acc.address)) return
            if (added.has(acc.address)) return
            const collision = byAddress.get(acc.address)
            if (collision) {
                if (collision.type === AccountTypes.watch) {
                    if (!upgrades.some(u => u.address === acc.address)) {
                        upgrades.push({
                            address: acc.address,
                            details: detailsFor(acc),
                        })
                    }
                } else if (
                    collision.type === AccountTypes.hardware &&
                    (collision.hardwareDetails.deviceId !== deviceId ||
                        collision.hardwareDetails.transportType !==
                            transportType)
                ) {
                    // Same address under a different stored device id — the
                    // OS forgot/re-paired or the device was replaced from the
                    // same seed. The address match proves the same key.
                    rebinds.push({
                        address: acc.address,
                        details: detailsFor(acc),
                    })
                }
                return
            }
            added.add(acc.address)
            batch.push({
                id: generateOrderedUniqueId(),
                name: t('ledger.default_account_name', {
                    number: nextDefaultNameNumber++,
                }),
                type: AccountTypes.hardware,
                address: acc.address,
                hardwareDetails: detailsFor(acc),
            })
        }

        for (const sel of selectedAccounts) {
            if (sel.kind === 'derived') {
                addHardware(sel.account)
            } else {
                addHardware(sel.authAccount)
                // Signable once this import lands: newly added, queued for
                // watch→hardware upgrade, or already present as a non-watch
                // account. A watch auth always queues an upgrade above, so a
                // present-but-watch auth can no longer slip through into an
                // unsignable pair.
                const authAddress = sel.authAccount.address
                const authPresent =
                    added.has(authAddress) ||
                    upgrades.some(u => u.address === authAddress) ||
                    (byAddress.has(authAddress) &&
                        byAddress.get(authAddress)?.type !== AccountTypes.watch)
                if (
                    authPresent &&
                    isValidAlgorandAddress(sel.address) &&
                    !byAddress.has(sel.address) &&
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

        if (
            batch.length === 0 &&
            upgrades.length === 0 &&
            rebinds.length === 0
        ) {
            exitAccountFlow()
            return
        }

        if (upgrades.length > 0) {
            const confirmed = await requestBottomSheet<boolean>({
                contents: <WatchAccountUpgradeSheet count={upgrades.length} />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            // Declining aborts the whole add (batch included): the batch may
            // contain rekeyed pairs that are only signable via the declined
            // upgrades, and a partial import would surprise more than a no-op.
            if (!confirmed) return
        }

        const store = useAccountsStore.getState()
        for (const upgrade of upgrades) {
            store.upgradeWatchAccountToHardware(
                upgrade.address,
                upgrade.details,
            )
        }
        for (const rebind of rebinds) {
            store.updateHardwareDetails(rebind.address, rebind.details)
        }
        if (batch.length > 0) {
            setAccounts([...useAccountsStore.getState().accounts, ...batch])
        }

        if (batch.length === 0 && upgrades.length === 0) {
            // Re-bind only: metadata refresh, not an import.
            exitAccountFlow()
            return
        }

        const firstDerived = selectedAccounts.find(s => s.kind === 'derived')
        const selectedAddress =
            firstDerived?.account.address ??
            batch[0]?.address ??
            upgrades[0]?.address
        if (selectedAddress) {
            setSelectedAccountAddress(selectedAddress)
        }
        setShouldPlayConfetti(true)
        exitAccountFlow()
    }, [
        deviceId,
        deviceName,
        transportType,
        selectedAccounts,
        requestBottomSheet,
        setAccounts,
        setSelectedAccountAddress,
        setShouldPlayConfetti,
        exitAccountFlow,
        t,
    ])

    // Guards double-taps while the upgrade confirmation sheet is open.
    const isAddingRef = useRef(false)
    const handleAdd = useCallback(() => {
        if (isAddingRef.current) return
        isAddingRef.current = true
        void runAdd().finally(() => {
            isAddingRef.current = false
        })
    }, [runAdd])

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
