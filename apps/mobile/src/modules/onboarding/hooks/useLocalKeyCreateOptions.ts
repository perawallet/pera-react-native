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
import {
    offeredLocalKeyKinds,
    useCreateAccount,
    type LocalKeyCreateOption,
    type LocalKeySeed,
} from '@perawallet/wallet-core-accounts'
import {
    isPostQuantumScheme,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { IconName } from '@components/core'
import { useCapability } from '@hooks/useCapability'
import { useWebView } from '@modules/webview'
import type { AccountOption } from '@modules/onboarding/types'
import { trackChainOnboardingEvent } from '../utils'
import type { UseRunCreateAccountResult } from './useRunCreateAccount'

export type UseLocalKeyCreateOptionsParams = {
    chainId: ChainId
    runCreateAccount: UseRunCreateAccountResult['runCreateAccount']
    isCreatingAccount: boolean
}

export type UseLocalKeyCreateOptionsResult = {
    featured: AccountOption[]
    other: AccountOption[]
}

export const useLocalKeyCreateOptions = ({
    chainId,
    runCreateAccount,
    isCreatingAccount,
}: UseLocalKeyCreateOptionsParams): UseLocalKeyCreateOptionsResult => {
    const scope = useSelectedScope(chainId)
    const { buildSingleKeyAccount } = useCreateAccount(scope)
    const { pushWebView } = useWebView()
    const isQuantumEnabled = useCapability({
        platform: 'quantum',
        anyChain: 'quantumAccounts',
    })

    // The account is built in memory; NameAccount persists it once named.
    const handleCreateKind = useCallback(
        (seed: LocalKeySeed, option: LocalKeyCreateOption) => {
            trackChainOnboardingEvent(option.analyticsEvent, scope.chainId)
            runCreateAccount(
                () => buildSingleKeyAccount({ seed }),
                option.progressTitleKey,
            )
        },
        [buildSingleKeyAccount, runCreateAccount, scope.chainId],
    )

    return useMemo(() => {
        const featured: AccountOption[] = []
        const other: AccountOption[] = []
        for (const { kind, options } of offeredLocalKeyKinds(scope.chainId)) {
            const option = options.create
            if (!option) continue
            if (isPostQuantumScheme(kind.signingScheme) && !isQuantumEnabled) {
                continue
            }
            const { learnMore } = option
            const row: AccountOption = {
                testID: `add_account_create_${option.id}_button`,
                titleKey: option.titleKey,
                descriptionKey: option.descriptionKey,
                leftIcon: option.icon as IconName,
                onPress: () => handleCreateKind(kind.seed, option),
                isDisabled: isCreatingAccount,
                badge: option.badgeKey
                    ? { labelKey: option.badgeKey, variant: 'new' }
                    : undefined,
                learnMore: learnMore
                    ? {
                          labelKey: learnMore.labelKey,
                          onPress: () =>
                              pushWebView({
                                  url: learnMore.url,
                                  id: `${option.id}-account-support`,
                              }),
                      }
                    : undefined,
            }
            ;(option.isFeatured ? featured : other).push(row)
        }
        return { featured, other }
    }, [
        scope.chainId,
        isQuantumEnabled,
        isCreatingAccount,
        handleCreateKind,
        pushWebView,
    ])
}
