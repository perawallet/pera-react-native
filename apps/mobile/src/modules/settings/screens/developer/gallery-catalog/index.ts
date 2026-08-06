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

import { getScreenSections } from './screens.catalog'
import { getSheetSections } from './sheets.catalog'
import { getDialogSections } from './dialogs.catalog'
import { getComponentSections } from './components.catalog'
import { getSharedComponentSections } from './shared-components.catalog'
import { getModuleComponentSections } from './module-components.catalog'
import { getToolSections } from './tools.catalog'

import type { GalleryCategory, GalleryCategoryId } from './types'

export type ToolHandlers = Parameters<typeof getToolSections>[0]

export const getCategories = (tools: ToolHandlers): GalleryCategory[] => [
    {
        id: 'screens',
        title: 'Screens',
        icon: 'phone',
        sections: getScreenSections(),
    },
    {
        id: 'sheets',
        title: 'Bottom Sheets',
        icon: 'card-stack',
        sections: getSheetSections(),
    },
    {
        id: 'dialogs',
        title: 'Dialogs',
        icon: 'envelope-letter',
        sections: getDialogSections(),
    },
    {
        id: 'components',
        title: 'Components',
        icon: 'grid-view',
        sections: [
            ...getComponentSections(),
            ...getSharedComponentSections(),
            ...getModuleComponentSections(),
        ],
    },
    {
        id: 'tools',
        title: 'Tools',
        icon: 'gear',
        sections: getToolSections(tools),
    },
]

export const getCategory = (
    id: GalleryCategoryId,
    tools: ToolHandlers,
): GalleryCategory | undefined => getCategories(tools).find(c => c.id === id)

export { getPreviewEntry } from './registry'

export { getScreenSections } from './screens.catalog'
export { getSheetSections } from './sheets.catalog'
export { getDialogSections } from './dialogs.catalog'
export { getComponentSections } from './components.catalog'
export { getSharedComponentSections } from './shared-components.catalog'
export { getModuleComponentSections } from './module-components.catalog'

export type {
    GalleryCategory,
    GalleryCategoryId,
    GalleryEntry,
    GallerySection,
} from './types'
