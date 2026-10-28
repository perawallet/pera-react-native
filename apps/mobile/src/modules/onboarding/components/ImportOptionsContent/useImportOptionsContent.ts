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

import { useMemo } from 'react'
import {
    offeredLocalKeyKinds,
    type LocalKeySeed,
} from '@perawallet/wallet-core-accounts'
import {
    isPostQuantumScheme,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useCapability } from '@hooks/useCapability'

export type ImportOptionRow = {
    seed: LocalKeySeed
    testID: string
    titleKey: I18nKey
    descriptionKey: I18nKey
    chipKey?: I18nKey
    chipVariant?: 'helper'
}

export type UseImportOptionsContentParams = {
    chainId: ChainId
}

export type UseImportOptionsContentResult = {
    options: ImportOptionRow[]
}

export const useImportOptionsContent = ({
    chainId,
}: UseImportOptionsContentParams): UseImportOptionsContentResult => {
    const isQuantumEnabled = useCapability({
        platform: 'quantum',
        anyChain: 'quantumAccounts',
    })

    // A kind with no recover option is offered only from the passphrase of
    // a kind it shares a word count with.
    const options = useMemo(
        () =>
            offeredLocalKeyKinds(chainId)
                .flatMap(({ kind, options: { recover } }) =>
                    recover &&
                    (!isPostQuantumScheme(kind.signingScheme) ||
                        isQuantumEnabled)
                        ? [{ kind, recover }]
                        : [],
                )
                .sort((a, b) => a.recover.order - b.recover.order)
                .map(({ kind, recover }): ImportOptionRow => ({
                    seed: kind.seed,
                    testID: `import_options_${recover.id}_button`,
                    titleKey: recover.titleKey,
                    descriptionKey: recover.descriptionKey,
                    chipKey: recover.chipKey,
                    chipVariant: recover.isSuggested ? 'helper' : undefined,
                })),
        [chainId, isQuantumEnabled],
    )

    return { options }
}
