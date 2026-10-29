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
import {
    buildAccount,
    chainAccountOf,
    findAccountByAddressOn,
    hardwareDetailsOf,
    hardwareJoinCandidates,
    type HardwareWalletDetails,
    isHardwareWalletAccount,
    isLedgerAccount,
    isWatchAccount,
    type LedgerSelectableAccount,
    recordAuthority,
    addHardwareChainAccount,
    getAllAccounts,
    updateHardwareDetails,
    upgradeWatchAccountToHardware,
    useSelectedAccountId,
    useSetAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ledgerAppNameFor,
    type HardwareWalletDerivedAccount,
    type HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    isLedgerClaimMetBy,
    ledgerClaimsByChain,
    ledgerHolderClaim,
    proveLedgerHolders,
    verifyLedgerAddress,
    withLedgerConfirmationTimeout,
    withLedgerConnectionTimeout,
    LedgerAddressMismatchError,
    classifyLedgerError,
    type LedgerHolderClaim,
} from '@perawallet/wallet-core-ledger'
import {
    logger,
    type AppError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    type AddAccountStackParamList,
    useExitAccountFlow,
    useShouldPlayConfetti,
} from '@modules/onboarding'
import {
    deserializeSelectableAccount,
    getLedgerErrorPreset,
    type LedgerErrorPreset,
    requireLedgerProvider,
} from '@modules/ledger/utils'
import { WatchAccountUpgradeSheet } from '@modules/ledger/components/WatchAccountUpgradeSheet'
import {
    LedgerSameWalletSheet,
    type LedgerSameWalletChoice,
} from '@modules/ledger/components/LedgerSameWalletSheet'
import {
    useLedgerExpandedTabHandoff,
    useLedgerFlowChainId,
} from '@modules/ledger/hooks'

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
    /** True while the device reads an existing account's address before adding. */
    isReadingDevice: boolean
    /** Set once accounts are added in a Ledger pairing tab, which then shows a result screen. */
    isAddedInHandoffTab: boolean
    handleDone: () => void
    /** Closes a Ledger pairing tab; undefined anywhere else. */
    handleCancel: (() => void) | undefined
    t: (key: string, options?: Record<string, unknown>) => string
}

type VerificationState = 'connecting' | 'verifying' | 'complete' | 'error'

const authAccountOf = (
    s: LedgerSelectableAccount,
): HardwareWalletDerivedAccount =>
    s.kind === 'derived' ? s.account : s.authAccount

/**
 * An entry bound for a device position, the address the device verified for
 * it, and the account it must not join.
 */
type JoinTarget = {
    details: HardwareWalletDetails
    chainIds: ChainId[]
    verifiedAddress: string
    movingId?: string
}

const claimsFor = (
    accounts: readonly WalletAccount[],
    { details, chainIds, movingId }: JoinTarget,
): LedgerHolderClaim[] =>
    hardwareJoinCandidates(
        accounts.filter(account => account.id !== movingId),
        details,
        chainIds,
    ).flatMap(holder => {
        const addresses: Partial<Record<ChainId, string>> = {}
        for (const id of Object.keys(holder.chains) as ChainId[]) {
            const address = chainAccountOf(holder, id)?.address
            if (address !== undefined) addresses[id] = address
        }
        const claim = ledgerHolderClaim({
            id: holder.id,
            accountIndex: holder.custody.accountIndex,
            addresses,
        })
        return claim ? [claim] : []
    })

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
    const { setSelectedAccountId } = useSelectedAccountId()
    const { exitAccountFlow } = useExitAccountFlow()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { request: requestBottomSheet } = useBottomSheet()
    const navigation = useAppNavigation()
    const chainId = useLedgerFlowChainId()
    const { isHandoffTab, closeHandoffTab } = useLedgerExpandedTabHandoff()
    const [isAddedInHandoffTab, setIsAddedInHandoffTab] = useState(false)
    const [isReadingDevice, setIsReadingDevice] = useState(false)

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

            const provider = requireLedgerProvider(transportType)

            const connectPromise = provider.connect(deviceId, chainId)
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
    }, [chainId, deviceId, transportType, verifyTargets])

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

    // Resolves the proven holder ids, or null when the user abandons the add.
    const proveClaims = useCallback(
        async (
            claims: readonly LedgerHolderClaim[],
        ): Promise<Nullable<ReadonlySet<string>>> => {
            const proven = new Set<string>()
            for (const [claimChain, chainClaims] of ledgerClaimsByChain(
                claims,
            )) {
                const appName = ledgerAppNameFor(claimChain)
                let failure: Nullable<LedgerErrorPreset> = null
                for (;;) {
                    const choice =
                        await requestBottomSheet<LedgerSameWalletChoice>({
                            contents: (
                                <LedgerSameWalletSheet
                                    appName={appName}
                                    failure={failure}
                                />
                            ),
                            options: {
                                size: 'auto',
                                enablePanDownToClose: true,
                            },
                        })
                    if (choice === undefined) return null
                    if (choice === 'separate') break
                    setIsReadingDevice(true)
                    try {
                        const read = await proveLedgerHolders({
                            provider: requireLedgerProvider(transportType),
                            deviceId,
                            chainId: claimChain,
                            claims: chainClaims,
                        })
                        for (const holderId of read) proven.add(holderId)
                        break
                    } catch (err) {
                        const readError = classifyLedgerError(err)
                        logger.warn('Ledger same-wallet read failed', {
                            chainId: claimChain,
                            error: readError,
                        })
                        failure = getLedgerErrorPreset(readError, t, appName)
                    } finally {
                        setIsReadingDevice(false)
                    }
                }
            }
            return proven
        },
        [deviceId, requestBottomSheet, t, transportType],
    )

    const runAdd = useCallback(async () => {
        const current = getAllAccounts()
        // Through the chain's codec: an EVM device reports a checksummed
        // address the wallet may hold in another case.
        const heldAt = (address: string) =>
            findAccountByAddressOn(current, chainId, address)
        const added = new Set<string>()
        const hardwareEntries: Array<{
            address: string
            details: HardwareWalletDetails
        }> = []
        const batch: WalletAccount[] = []
        const authorities: Array<{
            address: string
            authorityAddress: string
        }> = []
        const upgrades: Array<{
            id: string
            address: string
            details: HardwareWalletDetails
        }> = []
        const rebinds: Array<{
            id: string
            address: string
            details: HardwareWalletDetails
        }> = []

        // Default names number on from the ledger accounts already in the
        // wallet ("Ledger 3" after two prior imports) — count-based, so
        // renames/removals can repeat a number; names are not unique.
        let nextDefaultNameNumber = current.filter(isLedgerAccount).length + 1

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
            if (!addressCodecs.get(chainId).isValid(acc.address)) return
            if (added.has(acc.address)) return
            const collision = heldAt(acc.address)
            if (collision) {
                if (isWatchAccount(collision)) {
                    if (!upgrades.some(u => u.address === acc.address)) {
                        upgrades.push({
                            id: collision.id,
                            address: acc.address,
                            details: detailsFor(acc),
                        })
                    }
                } else if (
                    isHardwareWalletAccount(collision) &&
                    (hardwareDetailsOf(collision)?.deviceId !== deviceId ||
                        hardwareDetailsOf(collision)?.transportType !==
                            transportType)
                ) {
                    // Same address under a different stored device id — the
                    // OS forgot/re-paired or the device was replaced from the
                    // same seed. The address match proves the same key.
                    rebinds.push({
                        id: collision.id,
                        address: acc.address,
                        details: detailsFor(acc),
                    })
                }
                return
            }
            added.add(acc.address)
            hardwareEntries.push({
                address: acc.address,
                details: detailsFor(acc),
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
                const authorityAddress = sel.authAccount.address
                const presentAuth = heldAt(authorityAddress)
                const authPresent =
                    added.has(authorityAddress) ||
                    upgrades.some(u => u.address === authorityAddress) ||
                    (presentAuth !== undefined && !isWatchAccount(presentAuth))
                if (
                    authPresent &&
                    addressCodecs.get(chainId).isValid(sel.address) &&
                    !heldAt(sel.address) &&
                    !added.has(sel.address)
                ) {
                    added.add(sel.address)
                    // Every account carries a unique `id`; dedup within this
                    // import still keys on `address` (see `addHardware` above)
                    // because all account kinds today are on-chain.
                    batch.push(
                        buildAccount({
                            custody: { kind: 'watch' },
                            chainId,
                            chains: { [chainId]: { address: sel.address } },
                        }),
                    )
                    authorities.push({
                        address: sel.address,
                        authorityAddress,
                    })
                }
            }
        }

        if (
            hardwareEntries.length === 0 &&
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

        const movingTarget = (
            id: string,
            details: HardwareWalletDetails,
            verifiedAddress: string,
        ): JoinTarget => ({
            details,
            chainIds: Object.keys(
                current.find(account => account.id === id)?.chains ?? {},
            ) as ChainId[],
            verifiedAddress,
            movingId: id,
        })
        const targets = [
            ...upgrades.map(({ id, details, address }) =>
                movingTarget(id, details, address),
            ),
            ...rebinds.map(({ id, details, address }) =>
                movingTarget(id, details, address),
            ),
            ...hardwareEntries.map(({ details, address }) => ({
                details,
                chainIds: [chainId],
                verifiedAddress: address,
            })),
        ]
        const targetClaims = targets.map(target => claimsFor(current, target))
        // An address just verified in the same device app proves its claim.
        const met = targetClaims.flatMap((claims, i) =>
            claims
                .filter(claim =>
                    isLedgerClaimMetBy(claim, targets[i].verifiedAddress),
                )
                .map(claim => claim.holderId),
        )
        const pending = targetClaims
            .flat()
            .filter(claim => !met.includes(claim.holderId))
        // Only an import with a claim left to read waits on the device.
        const read =
            pending.length > 0 ? await proveClaims(pending) : new Set<string>()
        if (!read) return
        const proven = new Set([...met, ...read])
        const joinIdOf = (targetClaims: readonly LedgerHolderClaim[]) =>
            targetClaims.find(claim => proven.has(claim.holderId))?.holderId

        upgrades.forEach((upgrade, i) => {
            upgradeWatchAccountToHardware(
                upgrade.id,
                upgrade.details,
                chainId,
                joinIdOf(targetClaims[i]),
            )
        })
        rebinds.forEach((rebind, i) => {
            updateHardwareDetails(
                rebind.id,
                rebind.details,
                chainId,
                joinIdOf(targetClaims[upgrades.length + i]),
            )
        })
        for (const [i, { address, details }] of hardwareEntries.entries()) {
            const before = getAllAccounts().length
            addHardwareChainAccount(
                details,
                chainId,
                address,
                t('ledger.default_account_name', {
                    number: nextDefaultNameNumber,
                }),
                undefined,
                joinIdOf(targetClaims[upgrades.length + rebinds.length + i]),
            )
            // An entry joining the device's account keeps that account's
            // name, so only a created account uses up a number.
            if (getAllAccounts().length > before) {
                nextDefaultNameNumber++
            }
        }
        if (batch.length > 0) {
            const scope = getSelectedScope(chainId)
            for (const { address, authorityAddress } of authorities) {
                recordAuthority(scope, address, authorityAddress)
            }
            setAccounts([...getAllAccounts(), ...batch])
        }

        if (
            hardwareEntries.length === 0 &&
            batch.length === 0 &&
            upgrades.length === 0
        ) {
            // Re-bind only: metadata refresh, not an import.
            exitAccountFlow()
            return
        }

        const firstDerived = selectedAccounts.find(s => s.kind === 'derived')
        const selectedAddress =
            firstDerived?.account.address ??
            (batch[0] && chainAccountOf(batch[0], chainId)?.address) ??
            upgrades[0]?.address
        const selected = selectedAddress
            ? findAccountByAddressOn(getAllAccounts(), chainId, selectedAddress)
            : undefined
        if (selected) {
            setSelectedAccountId(selected.id)
        }
        if (isHandoffTab) {
            setIsAddedInHandoffTab(true)
            return
        }
        setShouldPlayConfetti(true)
        exitAccountFlow()
    }, [
        chainId,
        deviceId,
        deviceName,
        transportType,
        selectedAccounts,
        proveClaims,
        requestBottomSheet,
        setAccounts,
        setSelectedAccountId,
        setShouldPlayConfetti,
        exitAccountFlow,
        isHandoffTab,
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
        navigation.navigate('LedgerTroubleshooting', { chainId })
    }, [navigation, chainId])

    const handleDone = useCallback(() => {
        void closeHandoffTab()
    }, [closeHandoffTab])

    const errorPreset = useMemo(
        () =>
            verificationState === 'error' && error !== null
                ? getLedgerErrorPreset(error, t, ledgerAppNameFor(chainId))
                : null,
        [error, verificationState, t, chainId],
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
        isReadingDevice,
        isAddedInHandoffTab,
        handleDone,
        handleCancel: isHandoffTab ? handleDone : undefined,
        t,
    }
}
