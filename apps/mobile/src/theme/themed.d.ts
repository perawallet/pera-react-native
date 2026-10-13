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

import '@rneui/themed'
import type { AppColors } from './tokens/types'

declare module '@rneui/themed' {
    // An interface is required here: module augmentation can't merge a type alias.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface Colors extends AppColors {}

    export interface ThemeSpacing {
        xxs: number
        xxl: number
        '3xl': number
        '4xl': number
        '5xl': number
    }

    export interface Theme {
        colors: Colors
        zIndex: {
            base: number
            layer1: number
            layer2: number
            overlay1: number
            max: number
            toast: number
            integrityCheck: number
        }
        borderRadius: {
            none: number
            xs: number
            sm: number
            md: number
            lg: number
            xl: number
            full: number
        }
        borders: {
            none: number
            sm: number
            md: number
            lg: number
        }
        shadows: {
            sm: {
                shadowColor: string
                shadowOffset: { width: number; height: number }
                shadowOpacity: number
                shadowRadius: number
                elevation: number
            }
            md: {
                shadowColor: string
                shadowOffset: { width: number; height: number }
                shadowOpacity: number
                shadowRadius: number
                elevation: number
            }
        }
    }
}
