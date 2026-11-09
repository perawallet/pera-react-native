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

import type { ReactNode } from 'react'
import { useTheme } from '@rneui/themed'
import { PWDivider } from '@components/core'
import { RequestAddressWarning } from '@modules/signing/components/RequestAddressWarning'
import { RequestSiteWarning } from '@modules/signing/components/RequestSiteWarning'
import { SigningWarnings } from '@modules/signing/components/SigningWarnings'
import { useStyles } from './styles'

export type TransactionReviewLayoutProps = {
    header: ReactNode
    /** What the transaction will do, ahead of every other section. */
    summary?: ReactNode
    participants: ReactNode
    /** What the transaction does in full, after the fee. */
    details?: ReactNode
    /** The cost and its warnings, right after the participants so it is on screen without scrolling. */
    fee: ReactNode
}

// A Fragment, not a view: the screen's container spaces these children with its gap.
export const TransactionReviewLayout = ({
    header,
    summary,
    participants,
    details,
    fee,
}: TransactionReviewLayoutProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <>
            {header}

            {summary}

            <SigningWarnings />

            <RequestSiteWarning />

            <RequestAddressWarning />

            <PWDivider
                color={theme.colors.layerGray}
                style={styles.paddedDivider}
            />

            {participants}

            {fee}

            {details}
        </>
    )
}
