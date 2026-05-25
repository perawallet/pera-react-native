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

import type { ReactNode } from 'react'
import type {
    BottomSheetOptions,
    BottomSheetRegistry,
    BottomSheetRequest,
} from '@modules/bottom-sheet'
import type { IconName } from '@components/core/PWIcon'

export type GalleryCategoryId =
    | 'screens'
    | 'sheets'
    | 'dialogs'
    | 'components'
    | 'tools'

export type GalleryLaunch =
    | { kind: 'navigate'; target: { name: string; params?: object } }
    | { kind: 'sheet'; request: () => BottomSheetRequest }
    | {
          kind: 'sheetByType'
          type: keyof BottomSheetRegistry
          props: BottomSheetRegistry[keyof BottomSheetRegistry]
          options?: BottomSheetOptions
      }
    | { kind: 'action'; run: () => void }
    | { kind: 'preview' }

export type GalleryEntry = {
    id: string
    label: string
    launch: GalleryLaunch
}

export type GallerySection = {
    title: string
    items: GalleryEntry[]
}

export type GalleryCategory = {
    id: GalleryCategoryId
    title: string
    icon: IconName
    sections: GallerySection[]
}

export type GalleryPreviewEntry = {
    id: string
    render: () => ReactNode
}
