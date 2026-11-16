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
import type { SheetOption } from '@components/SheetOptionRow'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import type { AccountChainSectionProps } from '@modules/accounts'

export type UseEthereumAccountSectionResult = {
    options: SheetOption[]
}

// The list needs no signer: a watch account can see its approvals, just not revoke them.
export const useHasEthereumAccountSection = ({
    scope,
}: AccountChainSectionProps): boolean =>
    useCapability({
        chain: { chainId: scope.chainId, capability: 'tokenApprovals' },
    })

export const useEthereumAccountSection = ({
    account,
    scope,
    onClose,
}: AccountChainSectionProps): UseEthereumAccountSectionResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()

    const handleOpenTokenApprovals = useCallback(() => {
        onClose()
        navigation.navigate('TokenApprovals', { accountId: account.id, scope })
    }, [onClose, navigation, account.id, scope])

    const options = useMemo(
        (): SheetOption[] => [
            {
                id: 'token-approvals',
                icon: 'shield-check',
                title: t('account_options.token_approvals'),
                onPress: handleOpenTokenApprovals,
            },
        ],
        [t, handleOpenTokenApprovals],
    )

    return { options }
}
