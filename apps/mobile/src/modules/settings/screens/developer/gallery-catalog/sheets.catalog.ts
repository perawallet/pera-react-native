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

import {
    MOCK_ADDRESS,
    MOCK_ASSET_ID,
} from '@perawallet/wallet-core-dev-fixtures'

import type { GallerySection } from './types'

const A = MOCK_ADDRESS

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
]
