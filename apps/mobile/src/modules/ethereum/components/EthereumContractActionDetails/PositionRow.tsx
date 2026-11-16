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

import type { EvmLiquidityPosition } from '@perawallet/wallet-core-chain-ethereum'
import { PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'

type PositionRowProps = {
    position: EvmLiquidityPosition
}

export const PositionRow = ({ position }: PositionRowProps) => {
    const { t } = useLanguage()
    const isNew = position.kind === 'new'
    return (
        <KeyValueRow
            testID='ethereum_action_position'
            title={t(
                isNew
                    ? 'ethereum.contract_action.receive'
                    : 'ethereum.contract_action.position',
            )}
        >
            <PWText>
                {isNew
                    ? t('ethereum.contract_action.new_position')
                    : `#${position.tokenId}`}
            </PWText>
        </KeyValueRow>
    )
}
