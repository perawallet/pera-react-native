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

import type { SignInSummary } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { useLanguage } from '@hooks/useLanguage'
import { CautionCard } from '../CautionCard'
import { ReviewDetailRow } from '../ReviewDetailRow'
import { ReviewNetworkRow } from '../ReviewNetworkRow'
import { WarningBanner, WarningBannerBody } from '../WarningBanner'
import { useStyles } from './styles'
import {
    useSignInMessageDetails,
    type SignInDetailRow,
} from './useSignInMessageDetails'

// The full statement stays under Advanced; capped so it can't push the fields off screen.
const STATEMENT_MAX_LINES = 4

export type SignInMessageDetailsProps = {
    signIn: SignInSummary
    /** The message text exactly as signed. */
    rawText: string
    /** The requesting site, when the message is for another domain. */
    siteMismatch?: Optional<string>
}

export const SignInMessageDetails = ({
    signIn,
    rawText,
    siteMismatch,
}: SignInMessageDetailsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        leadingRows,
        trailingRows,
        unknownChainRow,
        resourceRows,
        grantsWarning,
        malformedWarning,
        statement,
        otherAddressNote,
        otherChainNote,
    } = useSignInMessageDetails(signIn)

    const renderRow = (row: SignInDetailRow) => (
        <ReviewDetailRow
            key={row.testID}
            label={row.label}
            testID={row.testID}
        >
            <PWText style={styles.value}>{row.value}</PWText>
        </ReviewDetailRow>
    )

    const renderGrant = (row: SignInDetailRow) => (
        <PWView
            key={row.testID}
            testID={row.testID}
        >
            <PWText variant='bodySemibold'>{row.label}</PWText>
            <PWText>{row.value}</PWText>
        </PWView>
    )

    return (
        <PWView style={styles.container}>
            {!!malformedWarning && (
                <WarningBanner
                    title={t('signing.sign_in.malformed_title')}
                    testID='sign_in_malformed'
                >
                    <WarningBannerBody>{malformedWarning}</WarningBannerBody>
                </WarningBanner>
            )}
            {!!siteMismatch && (
                <WarningBanner
                    title={t('signing.sign_in.site_mismatch_title')}
                    testID='sign_in_site_mismatch'
                >
                    <WarningBannerBody>
                        {t('signing.sign_in.site_mismatch_body', {
                            domain: signIn.message.domain,
                            site: siteMismatch,
                        })}
                    </WarningBannerBody>
                </WarningBanner>
            )}
            {!!grantsWarning && (
                <WarningBanner
                    title={t('signing.sign_in.grants_title')}
                    testID='sign_in_grants_warning'
                >
                    <WarningBannerBody>{grantsWarning.body}</WarningBannerBody>
                    {grantsWarning.rows.map(renderGrant)}
                </WarningBanner>
            )}
            {!!statement && (
                <PWView
                    style={styles.dataBox}
                    testID='sign_in_statement'
                >
                    <PWText variant='captionMedium'>{statement.label}</PWText>
                    <PWText numberOfLines={STATEMENT_MAX_LINES}>
                        {statement.text}
                    </PWText>
                </PWView>
            )}
            <PWView>
                {leadingRows.map(renderRow)}
                {signIn.messageScope ? (
                    <ReviewNetworkRow scope={signIn.messageScope} />
                ) : (
                    !!unknownChainRow && renderRow(unknownChainRow)
                )}
                {trailingRows.map(renderRow)}
                {resourceRows.map(renderRow)}
            </PWView>
            {!!otherAddressNote && (
                <CautionCard
                    icon='info'
                    message={otherAddressNote}
                    testID='sign_in_other_address'
                />
            )}
            {!!otherChainNote && (
                <CautionCard
                    icon='info'
                    message={otherChainNote}
                    testID='sign_in_other_chain'
                />
            )}
            <TitledExpandablePanel
                title={t('signing.sign_in.advanced')}
                testID='sign_in_advanced'
            >
                <PWView style={styles.dataBox}>
                    <PWText variant='mono'>{rawText}</PWText>
                </PWView>
            </TitledExpandablePanel>
        </PWView>
    )
}
