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

import { useCallback, useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import {
    AuthorityTargetCategories,
    addressOn,
    isMultisigAccount,
    useAccountStateQuery,
    useCanSignWith,
    type AuthorityTargetCategory,
} from '@perawallet/wallet-core-accounts'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { SheetOption } from '@components/SheetOptionRow'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { rekeyRequirementFor } from '@hooks/capabilityRequirements'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import type { AccountChainSectionProps } from '@modules/accounts'
import {
    trackEvent,
    AccountDetailsEvent,
    AccountOptionsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import {
    RekeyOptionsContent,
    type RekeyTargetType,
} from '../RekeyOptionsContent'

export type UseAlgorandAccountSectionResult = {
    /** In the native asset's display units; null until the account state loads. */
    minBalance: Nullable<Decimal>
    isMinBalanceLoading: boolean
    showMinBalance: boolean
    options: SheetOption[]
}

export const useAlgorandAccountSection = ({
    account,
    scope,
    onClose,
}: AccountChainSectionProps): UseAlgorandAccountSectionResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const address = addressOn(account, scope) ?? ''
    const canSign = useCanSignWith(account, scope.chainId)
    const canRekey = useCapability(rekeyRequirementFor(scope.chainId))
    const canUseMultisig = useCapability({
        platform: 'sharedAccounts',
        anyChain: 'multisig',
    })
    const isSharedAccount = isMultisigAccount(account)

    const { data: accountState, isLoading: isMinBalanceLoading } =
        useAccountStateQuery(account, scope)
    const { decimals } = useNativeAsset(scope)
    const reserveBalance = accountState?.reserveBalance
    const minBalance = useMemo(
        () =>
            reserveBalance === undefined
                ? null
                : baseUnitsToDisplayUnits(reserveBalance, decimals),
        [reserveBalance, decimals],
    )

    const navigateToRekeyFlow = useCallback(
        (target: AuthorityTargetCategory) => {
            switch (target) {
                case AuthorityTargetCategories.hardware: {
                    trackEvent(AccountOptionsEvent.RekeyToLedger, {
                        [AnalyticsMetadataKey.ChainId]: scope.chainId,
                    })
                    navigation.navigate('RekeyToLedger', {
                        screen: 'RekeyToLedgerIntro',
                        params: { sourceAddress: address },
                    })
                    return
                }
                case AuthorityTargetCategories.standard: {
                    trackEvent(AccountOptionsEvent.RekeyToStandard, {
                        [AnalyticsMetadataKey.ChainId]: scope.chainId,
                    })
                    navigation.navigate('RekeyToStandard', {
                        screen: 'RekeyToStandardIntro',
                        params: { sourceAddress: address },
                    })
                    return
                }
                case AuthorityTargetCategories.postQuantum: {
                    trackEvent(AccountOptionsEvent.RekeyToQuantum, {
                        [AnalyticsMetadataKey.ChainId]: scope.chainId,
                    })
                    navigation.navigate('RekeyToQuantum', {
                        screen: 'RekeyToQuantumIntro',
                        params: { sourceAddress: address },
                    })
                    return
                }
                case AuthorityTargetCategories.shared: {
                    trackEvent(AccountDetailsEvent.JointAccountRekey, {
                        [AnalyticsMetadataKey.ChainId]: scope.chainId,
                    })
                    navigation.navigate('RekeyToShared', {
                        screen: 'RekeyToSharedIntro',
                        params: { sourceAddress: address },
                    })
                }
            }
        },
        [navigation, address, scope.chainId],
    )

    const handleRekeyAccount = useCallback(async () => {
        onClose()
        // A shared account can only be rekeyed to another shared account, so
        // the type sheet would hold a single row — go straight to its intro.
        if (isSharedAccount) {
            navigateToRekeyFlow(AuthorityTargetCategories.shared)
            return
        }
        const target = await requestBottomSheet<RekeyTargetType>({
            contents: <RekeyOptionsContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!target) return
        navigateToRekeyFlow(target)
    }, [onClose, isSharedAccount, requestBottomSheet, navigateToRekeyFlow])

    const handleScanRekeyed = useCallback(() => {
        trackEvent(AccountOptionsEvent.ScanRekeyed, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        onClose()
        navigation.navigate('RescanRekeyed', {
            screen: 'RescanRekeyedSelect',
            params: { sourceAddress: address },
        })
    }, [onClose, navigation, address, scope.chainId])

    const options = useMemo(() => {
        const items: SheetOption[] = []
        // Gated on the capability, not just on the account: every rekey target
        // is a root stack that a platform may not register, and an
        // unregistered route makes the row a silent no-op rather than an error.
        // Rekeying also needs a signature from the source account. A shared
        // account's only target is another shared account.
        if (canRekey && canSign && (!isSharedAccount || canUseMultisig)) {
            items.push({
                id: 'rekey-account',
                icon: 'rekey',
                title: t('account_options.rekey_account'),
                onPress: () => void handleRekeyAccount(),
            })
        }
        // Post-import rekey discovery: a watch account holds no key another
        // account could be rekeyed to sign with.
        if (canRekey && canSign) {
            items.push({
                id: 'scan-rekeyed',
                icon: 'magnifying-glass',
                title: t('account_options.scan_rekeyed'),
                onPress: handleScanRekeyed,
            })
        }
        return items
    }, [
        t,
        canRekey,
        canSign,
        isSharedAccount,
        canUseMultisig,
        handleRekeyAccount,
        handleScanRekeyed,
    ])

    return {
        minBalance,
        isMinBalanceLoading,
        showMinBalance: canSign,
        options,
    }
}

// The min balance and every option need a signer, so a signer is all the section hinges on.
export const useHasAlgorandAccountSection = ({
    account,
    scope,
}: AccountChainSectionProps): boolean => useCanSignWith(account, scope.chainId)
