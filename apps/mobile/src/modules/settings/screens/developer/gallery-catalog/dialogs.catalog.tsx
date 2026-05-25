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

import { MultisigIntroductionDialog } from '@modules/multisig/components/MultisigIntroductionDialog'
import { PWDialog } from '@components/core'

import { registerPreview } from './registry'

import type { GallerySection } from './types'

registerPreview({
    id: 'dlg-pw-dialog',
    render: () => (
        <PWDialog isVisible={true} onBackdropPress={() => undefined}>
            <PWDialog.Title title='Preview Dialog' />
        </PWDialog>
    ),
})

registerPreview({
    id: 'dlg-multisig-intro',
    render: () => (
        <MultisigIntroductionDialog
            isVisible={true}
            onContinue={() => undefined}
            onDismiss={() => undefined}
        />
    ),
})

export const getDialogSections = (): GallerySection[] => [
    {
        title: 'Dialogs',
        items: [
            { id: 'dlg-pw-dialog', label: 'PWDialog (primitive)', launch: { kind: 'preview' } },
            { id: 'dlg-multisig-intro', label: 'Multisig introduction', launch: { kind: 'preview' } },
        ],
    },
]
