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

import type React from 'react'
import { SettingsDeveloperGalleryScreen } from '../screens/developer/SettingsDeveloperGalleryScreen'
import { GalleryCategoryScreen } from '../screens/developer/GalleryCategoryScreen'
import { GalleryComponentPreviewScreen } from '../screens/developer/GalleryComponentPreviewScreen'

export type DeveloperGalleryScreens = {
    GalleryScreen: React.ComponentType
    GalleryCategoryScreen: React.ComponentType
    GalleryPreviewScreen: React.ComponentType
}

// The gallery's only way into the app graph: metro.config.js swaps this for
// developer-gallery.stub.ts in production bundles, dropping every screen and
// catalog module behind it. Import gallery screens from here, never directly.
export const developerGalleryScreens: DeveloperGalleryScreens | null = {
    GalleryScreen: SettingsDeveloperGalleryScreen,
    GalleryCategoryScreen,
    GalleryPreviewScreen: GalleryComponentPreviewScreen,
}
