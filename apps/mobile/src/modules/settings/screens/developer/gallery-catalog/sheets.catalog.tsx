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
]
