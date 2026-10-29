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
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    ComparedAddress,
    diffAddresses,
    KNOWN_LABEL_KEYS,
} from '@modules/transactions'
import { type FlaggedRequestAddress } from '../../../hooks/useRequestAddressSafety'
import { useStyles } from '../styles'
import { ROLE_LABEL_KEYS } from '../roleLabelKeys'

export type LookAlikeAddressProps = {
    flagged: FlaggedRequestAddress
    index: number
    chainId: ChainId
}

export const LookAlikeAddress = ({
    flagged,
    index,
    chainId,
}: LookAlikeAddressProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const comparison = useMemo(() => {
        if (flagged.assessment.kind !== 'look-alike') return undefined
        const codec = addressCodecs.get(chainId)
        const { knownAddress } = flagged.assessment
        return {
            diff: diffAddresses(
                codec.normalize(flagged.address),
                codec.normalize(knownAddress.address),
            ),
            knownLabel: t(KNOWN_LABEL_KEYS[knownAddress.source], {
                name: knownAddress.name ?? codec.truncate(knownAddress.address),
            }),
        }
    }, [flagged, chainId, t])

    if (!comparison) return null

    return (
        <PWView style={styles.address}>
            <ComparedAddress
                label={t(ROLE_LABEL_KEYS[flagged.role])}
                segments={comparison.diff.a}
                testID={`request_address_look_alike_${index}`}
            />
            <ComparedAddress
                label={comparison.knownLabel}
                segments={comparison.diff.b}
                testID={`request_address_look_alike_known_${index}`}
            />
        </PWView>
    )
}
