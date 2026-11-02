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
import { type RouteProp, useRoute } from '@react-navigation/native'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { PWResultViewAction, PWResultViewVariant } from '@components/core'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { networkListOf } from '@modules/chain-ui'
import { useExitAccountFlow } from '../../hooks'
import type { OnboardingStackParamList } from '../../routes/types'

export type UseScanAccountsResultScreenResult = {
    variant: PWResultViewVariant
    title: string
    body: string
    /** Every account the scan created or turned a network on for. */
    changedAccounts: WalletAccount[]
    primaryAction: PWResultViewAction
    secondaryAction: Optional<PWResultViewAction>
}

export const useScanAccountsResultScreen =
    (): UseScanAccountsResultScreenResult => {
        const { params } =
            useRoute<
                RouteProp<OnboardingStackParamList, 'ScanAccountsResult'>
            >()
        const {
            account,
            changedAccountIds,
            createdAccountIds,
            failedChainIds,
            isCancelled,
        } = params
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { exitAccountFlow } = useExitAccountFlow()
        const accounts = useAccountsStore(state => state.accounts)

        const changedAccounts = useMemo(
            () => accounts.filter(held => changedAccountIds.includes(held.id)),
            [accounts, changedAccountIds],
        )
        const createdCount = changedAccounts.filter(held =>
            createdAccountIds.includes(held.id),
        ).length
        const updatedCount = changedAccounts.length - createdCount
        const networks = networkListOf(failedChainIds, t)
        const hasFailedNetworks = failedChainIds.length > 0
        const isIncomplete =
            params.isIncomplete && !isCancelled && !hasFailedNetworks

        const scanAgain = useCallback(
            (chainIds?: typeof failedChainIds) =>
                navigation.replace('SearchAccounts', { account, chainIds }),
            [navigation, account],
        )

        const { variant, title, body } = useMemo(() => {
            const hasChanges = changedAccounts.length > 0
            let foundTitle = t('onboarding.scan_accounts_result.none_title')
            if (createdCount > 0) {
                foundTitle = t('onboarding.scan_accounts_result.found_title', {
                    count: createdCount,
                })
            } else if (updatedCount > 0) {
                foundTitle = t(
                    'onboarding.scan_accounts_result.updated_title',
                    {
                        count: updatedCount,
                    },
                )
            }
            if (isCancelled) {
                return {
                    variant: 'warning' as const,
                    title: t('onboarding.scan_accounts_result.cancelled_title'),
                    body: hasChanges
                        ? t('onboarding.scan_accounts_result.cancelled_body')
                        : t(
                              'onboarding.scan_accounts_result.cancelled_none_body',
                          ),
                }
            }
            if (hasFailedNetworks) {
                return {
                    variant: 'warning' as const,
                    title: foundTitle,
                    body: hasChanges
                        ? t(
                              'onboarding.scan_accounts_result.failed_networks_body',
                              { networks },
                          )
                        : t(
                              'onboarding.scan_accounts_result.failed_networks_none_body',
                              { networks },
                          ),
                }
            }
            if (isIncomplete) {
                return {
                    variant: 'warning' as const,
                    title: foundTitle,
                    body: t('onboarding.scan_accounts_result.incomplete_body'),
                }
            }
            if (createdCount > 0) {
                const createdBody = t(
                    'onboarding.scan_accounts_result.found_body',
                    { count: createdCount },
                )
                return {
                    variant: 'success' as const,
                    title: foundTitle,
                    body:
                        updatedCount > 0
                            ? `${createdBody} ${t(
                                  'onboarding.scan_accounts_result.updated_note',
                                  { count: updatedCount },
                              )}`
                            : createdBody,
                }
            }
            return {
                variant: 'success' as const,
                title: foundTitle,
                body:
                    updatedCount > 0
                        ? t('onboarding.scan_accounts_result.updated_body', {
                              count: updatedCount,
                          })
                        : t('onboarding.scan_accounts_result.none_body'),
            }
        }, [
            changedAccounts.length,
            createdCount,
            updatedCount,
            hasFailedNetworks,
            isCancelled,
            isIncomplete,
            networks,
            t,
        ])

        const secondaryAction = useMemo<Optional<PWResultViewAction>>(() => {
            if (hasFailedNetworks && !isCancelled) {
                return {
                    label: t('onboarding.scan_accounts_result.retry_networks', {
                        networks,
                    }),
                    onPress: () => scanAgain(failedChainIds),
                }
            }
            if (isCancelled || isIncomplete) {
                return {
                    label: t('onboarding.scan_accounts_result.scan_again'),
                    onPress: () => scanAgain(),
                }
            }
            return undefined
        }, [
            hasFailedNetworks,
            isCancelled,
            isIncomplete,
            networks,
            failedChainIds,
            scanAgain,
            t,
        ])

        return {
            variant,
            title,
            body,
            changedAccounts,
            primaryAction: {
                label: t('onboarding.scan_accounts_result.done'),
                onPress: () => exitAccountFlow(),
            },
            secondaryAction,
        }
    }
