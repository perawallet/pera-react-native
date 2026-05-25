/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React from 'react'

import {
    MOCK_ADDRESS,
    MOCK_ASSET_ID,
    mockAlgo25Account,
} from '@perawallet/wallet-core-dev-fixtures'
import { Decimal } from 'decimal.js'

import { AccountMenuContent } from '@modules/accounts/components/AccountMenuContent'
import { AccountOptionsContent } from '@modules/accounts/components/AccountOptionsContent'
import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'
import { AssetFilterContent } from '@modules/accounts/components/AssetFilterContent'
import { AssetSortContent } from '@modules/accounts/components/AssetSortContent'
import { ManageAssetsContent } from '@modules/accounts/components/ManageAssetsContent'
import { ManageNftsContent } from '@modules/accounts/components/ManageNftsContent'
import { NftFilterContent } from '@modules/accounts/components/NftFilterContent'
import { NftSortContent } from '@modules/accounts/components/NftSortContent'
import { SharedAccountDetailsContent } from '@modules/accounts/components/SharedAccountDetailsContent'
import {
    TransactionsFilterContent,
    TransactionFilter,
} from '@modules/accounts/components/TransactionsFilterContent'
import { OptOutConfirmationContent } from '@modules/accounts/components/AccountAssetList/OptOutConfirmationContent'
import { AddAssetContent } from '@modules/assets/components/AddAssetContent'
import { AsaVerificationInfoContent } from '@modules/assets/components/AsaVerificationInfoContent'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
import { ViewTextDetailsContent } from '@modules/transactions/components/ViewTextDetailsContent'
import { SwapAssetSelectionContent } from '@modules/swap/components/SwapAssetSelectionContent'
import { SwapConfigurationContent } from '@modules/swap/components/SwapConfigurationContent'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'
import { SwapIntroductionContent } from '@modules/swap/components/SwapIntroductionContent'
import { SigningCompletedContent } from '@modules/signing/components/SigningCompletedContent'
import { LedgerAwaitingApprovalContent } from '@modules/signing/components/LedgerAwaitingApprovalContent'
import { LedgerErrorContent } from '@modules/signing/components/LedgerErrorContent'
import { RekeyGuardContent } from '@modules/signing/components/RekeyGuardContent'
import { SecurityGuardContent } from '@modules/signing/components/SecurityGuardContent'
import { TransactionRequestFAQContent } from '@modules/signing/components/TransactionRequestFAQContent'
import { LedgerAccountInfoContent } from '@modules/ledger/components/LedgerAccountInfoContent'
import { LedgerConnectingContent } from '@modules/ledger/components/LedgerConnectingContent'
import { LedgerHowItWorksContent } from '@modules/ledger/components/LedgerHowItWorksContent'
import { AddParticipantContent } from '@modules/multisig/components/AddParticipantContent'
import { BeforeYouCreateContent } from '@modules/multisig/components/BeforeYouCreateContent'
import { ExportShareAccountContent } from '@modules/multisig/components/ExportShareAccountContent'
import { MultisigInvitationDetailContent } from '@modules/messages/components/MultisigInvitationDetailContent'

import { GallerySheetBoundary } from './GallerySheetBoundary'

import type { GallerySection } from './types'

const A = MOCK_ADDRESS
const A2 = MOCK_ADDRESS

export const getSheetSections = (): GallerySection[] => [
    {
        title: 'Registered',
        items: [
            {
                id: 'sheet-account-actions',
                label: 'Account actions',
                launch: {
                    kind: 'sheetByType',
                    type: 'account-actions',
                    props: { address: A },
                    options: { enablePanDownToClose: true },
                },
            },
            {
                id: 'sheet-asset-opt-in',
                label: 'Asset opt-in',
                launch: {
                    kind: 'sheetByType',
                    type: 'asset-opt-in',
                    props: { assetId: MOCK_ASSET_ID, accountAddress: A },
                    options: { enablePanDownToClose: true },
                },
            },
            {
                id: 'sheet-send-funds',
                label: 'Send funds',
                launch: {
                    kind: 'sheetByType',
                    type: 'send-funds',
                    props: {},
                    options: {
                        size: 'lg',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                },
            },
            {
                id: 'sheet-bidali',
                label: 'Bidali gift cards',
                launch: {
                    kind: 'sheetByType',
                    type: 'bidali',
                    props: {},
                    options: {
                        size: 'lg',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                },
            },
        ],
    },
    {
        title: 'Accounts',
        items: [
            {
                id: 'sheet-account-menu',
                label: 'Account menu',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AccountMenuContent />
                            </GallerySheetBoundary>
                        ),
                        options: { size: 'lg', enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-account-options',
                label: 'Account options',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AccountOptionsContent
                                    account={mockAlgo25Account}
                                    onShowAddress={() => undefined}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { size: 'lg', enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-account-sort',
                label: 'Account sort',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AccountSortContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-asset-filter',
                label: 'Asset filter',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AssetFilterContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-asset-sort',
                label: 'Asset sort',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AssetSortContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-manage-assets',
                label: 'Manage assets',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <ManageAssetsContent isReadOnly={false} />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-manage-nfts',
                label: 'Manage NFTs',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <ManageNftsContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-nft-filter',
                label: 'NFT filter',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <NftFilterContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-nft-sort',
                label: 'NFT sort',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <NftSortContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-shared-account-details',
                label: 'Shared account details',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SharedAccountDetailsContent
                                    details={{
                                        name: 'Mock Multisig',
                                        address: A,
                                        participantCount: 2,
                                        threshold: 2,
                                        addresses: [A, A2],
                                    }}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { size: 'lg', enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-transactions-filter',
                label: 'Transactions filter',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <TransactionsFilterContent
                                    activeFilter={TransactionFilter.AllTime}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-opt-out-confirmation',
                label: 'Opt-out confirmation',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <OptOutConfirmationContent
                                    accountBalance={{
                                        assetId: MOCK_ASSET_ID,
                                        amount: new Decimal(100),
                                        algoValue: new Decimal(0),
                                    }}
                                    accountAddress={A}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
        ],
    },
    {
        title: 'Assets',
        items: [
            {
                id: 'sheet-add-asset',
                label: 'Add asset',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AddAssetContent variant='asset' />
                            </GallerySheetBoundary>
                        ),
                        options: { size: 'lg', enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-asa-verification-info',
                label: 'ASA verification info',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AsaVerificationInfoContent />
                            </GallerySheetBoundary>
                        ),
                        options: { size: 'lg', enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-opt-in-confirmation',
                label: 'Opt-in confirmation',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <OptInConfirmationContent
                                    assetId={MOCK_ASSET_ID}
                                    accountAddress={A}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
        ],
    },
    {
        title: 'Transactions',
        items: [
            {
                id: 'sheet-transaction-warnings',
                label: 'Transaction warnings (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-view-text-details',
                label: 'View text details',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <ViewTextDetailsContent
                                    text='SGVsbG8gUGVyYSBXYWxsZXQ='
                                    title='Note'
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-raw-transaction',
                label: 'Raw transaction (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-add-note',
                label: 'Add note (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Swap',
        items: [
            {
                id: 'sheet-swap-asset-selection-from',
                label: 'Swap asset selection (from)',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SwapAssetSelectionContent variant='from' />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-swap-asset-selection-to',
                label: 'Swap asset selection (to)',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SwapAssetSelectionContent
                                    variant='to'
                                    fromAssetId={String(MOCK_ASSET_ID)}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-swap-configuration',
                label: 'Swap configuration',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SwapConfigurationContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-swap-confirmation',
                label: 'Swap confirmation (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-swap-history',
                label: 'Swap history',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SwapHistoryContent address={A} />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-swap-introduction',
                label: 'Swap introduction',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SwapIntroductionContent />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-swap-provider',
                label: 'Swap provider (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Signing',
        items: [
            {
                id: 'sheet-sign-request',
                label: 'Sign request (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-signing-completed-transaction',
                label: 'Signing completed (transaction)',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SigningCompletedContent isTransaction />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-signing-completed-data',
                label: 'Signing completed (data)',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SigningCompletedContent isTransaction={false} />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-signing-warnings',
                label: 'Signing warnings (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-ledger-signing',
                label: 'Ledger signing (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-ledger-connection-issue',
                label: 'Ledger connection issue (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-ledger-error',
                label: 'Ledger error',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <LedgerErrorContent
                                    error={{
                                        kind: 'connection_failed',
                                        title: 'Connection failed',
                                        body: 'Unable to connect to Ledger device. Make sure it is unlocked and the Algorand app is open.',
                                        isTroubleshootable: true,
                                        isRetryable: true,
                                    }}
                                    onRetry={() => undefined}
                                    onClose={() => undefined}
                                    onOpenTroubleshooting={() => undefined}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-ledger-awaiting-approval',
                label: 'Ledger awaiting approval',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <LedgerAwaitingApprovalContent
                                    deviceName='Ledger Nano X'
                                    currentTx={1}
                                    totalTxs={3}
                                    operation='transaction'
                                    onCancel={() => undefined}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-rekey-guard',
                label: 'Rekey guard',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <RekeyGuardContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-security-guard-rekey',
                label: 'Security guard (rekey)',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SecurityGuardContent warningType='rekey' />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-security-guard-asset-freeze',
                label: 'Security guard (asset freeze)',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <SecurityGuardContent warningType='asset-freeze' />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-transaction-request-faq',
                label: 'Transaction request FAQ',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <TransactionRequestFAQContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
        ],
    },
    {
        title: 'Ledger',
        items: [
            {
                id: 'sheet-ledger-account-info',
                label: 'Ledger account info',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <LedgerAccountInfoContent
                                    address={A}
                                    accountIndex={0}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-ledger-connecting',
                label: 'Ledger connecting',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <LedgerConnectingContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-ledger-how-it-works',
                label: 'Ledger how it works',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <LedgerHowItWorksContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
        ],
    },
    {
        title: 'Multisig',
        items: [
            {
                id: 'sheet-add-participant',
                label: 'Add participant',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <AddParticipantContent />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-before-you-create',
                label: 'Before you create',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <BeforeYouCreateContent />
                            </GallerySheetBoundary>
                        ),
                        options: { enablePanDownToClose: true },
                    }),
                },
            },
            {
                id: 'sheet-export-share-account',
                label: 'Export share account',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <ExportShareAccountContent accountAddress={A} />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
            {
                id: 'sheet-pending-signatures',
                label: 'Pending signatures (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'sheet-multisig-invitation-detail',
                label: 'Multisig invitation detail',
                launch: {
                    kind: 'sheet',
                    request: () => ({
                        contents: (
                            <GallerySheetBoundary>
                                <MultisigInvitationDetailContent
                                    invitation={{
                                        customId: 'mock-invite-id',
                                        createdAt:
                                            new Date().toISOString(),
                                        address: A,
                                        version: 1,
                                        threshold: 2,
                                        participantAddresses: [A, A2],
                                    }}
                                />
                            </GallerySheetBoundary>
                        ),
                        options: {
                            size: 'lg',
                            enablePanDownToClose: true,
                        },
                    }),
                },
            },
        ],
    },
]
