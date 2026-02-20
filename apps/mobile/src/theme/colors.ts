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

/**
 * Global color palette from Figma design system.
 * These are raw primitive colors — always use semantic tokens
 * (lightColors / darkColors) in components, never palette directly.
 */
export const palette = {
    turquoise: {
        50: '#EBFEF7',
        100: '#D8FDEE',
        200: '#B2FBE3',
        300: '#8BF4DB',
        400: '#6BE9D6',
        500: '#3EDBD2',
        600: '#2CB7BC',
        700: '#1F8E9D',
        800: '#136880',
        900: '#0B4D68',
    },
    purple: {
        50: '#F0ECFF',
        100: '#E5D9FF',
        200: '#D3BFFF',
        300: '#BDA6FF',
        400: '#AC8EFF',
        500: '#8162FF',
        600: '#6B46FE',
        700: '#5231D5',
        800: '#2B1583',
        900: '#1E0B69',
    },
    salmon: {
        50: '#FFF5EF',
        100: '#FFECDF',
        200: '#FFD3BE',
        300: '#FFB69F',
        400: '#FF9B86',
        500: '#FF6D5F',
        600: '#DB4645',
        700: '#B72D37',
        800: '#931D2D',
        900: '#7A1128',
    },
    blush: {
        50: '#FFF9F8',
        100: '#FEF3F1',
        200: '#FEE5E3',
        300: '#FCD5D5',
        400: '#FAC9CE',
        500: '#F8B7C4',
        600: '#D5859D',
        700: '#B15D7D',
        800: '#8E3B63',
        900: '#772552',
    },
    gray: {
        50: '#FAFAFA',
        100: '#F1F1F2',
        200: '#E4E4E7',
        300: '#D4D4D8',
        400: '#A1A1AA',
        500: '#71717A',
        600: '#52525B',
        700: '#3F3F46',
        800: '#27272A',
        900: '#18181B',
    },
    yellow: {
        100: '#FFFBD4',
        200: '#FFF8BA',
        300: '#FFF387',
        400: '#FFEE55',
        500: '#EDB21C',
        600: '#C77700',
    },
    black: '#000000',
    white: '#FFFFFF',
} as const
