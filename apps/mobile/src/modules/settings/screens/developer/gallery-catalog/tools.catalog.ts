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

import { startGalleryTour } from '@routes/galleryTour'
import { startApiRecording } from '../SettingsDeveloperGalleryScreen/devApiMock'

import type { GallerySection } from './types'

type ToolHandlers = {
    onSeedContacts: () => void
    onReplayApi: () => void
}

export const getToolSections = ({
    onSeedContacts,
    onReplayApi,
}: ToolHandlers): GallerySection[] => [
    {
        title: 'Tools',
        items: [
            {
                id: 'tool-tour',
                label: 'Run screenshot tour',
                launch: { kind: 'action', run: startGalleryTour },
            },
            {
                id: 'tool-seed',
                label: 'Seed mock data (contacts)',
                launch: { kind: 'action', run: onSeedContacts },
            },
            {
                id: 'tool-record',
                label: 'Record API (online)',
                launch: { kind: 'action', run: startApiRecording },
            },
            {
                id: 'tool-replay',
                label: 'Replay API (offline)',
                launch: { kind: 'action', run: onReplayApi },
            },
        ],
    },
]
