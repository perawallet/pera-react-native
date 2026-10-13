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

/**
 * Global color palette from Figma design system.
 * These are raw primitive colors — always use semantic tokens
 * (theme.colors.*, defined in tokens/) in components, never palette directly.
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

/** Colours the design system uses outside the ramps above. */
export const accentPalette = {
    magenta: '#9B1F69',
    cream: '#FFEAC2',
    pink: '#FFAEE3',
    navy: '#424F76',
    violet: '#8755D5',
    rose: '#F5B2C6',
    blue: '#0D7FFF',
    blueLight: '#48A7FE',
    stakingLiquid: 'rgba(255,110,92,1)',
    stakingPools: 'rgba(31,142,157,1)',
    stakingDelegated: 'rgba(255,174,227,1)',
    moonpay: '#7D01FF',
    sardine: '#2925CB',
    transak: '#2A6BE6',
    bidali: '#6241E2',
} as const

/**
 * Alpha tints shared by more than one token, named `<base>Alpha<percent>`
 * after the palette or accent colour they are drawn from.
 */
export const tints = {
    turquoise600Alpha12: 'rgba(44, 183, 188, 0.12)',
    turquoise600Alpha16: 'rgba(44, 183, 188, 0.16)',
    turquoise600Alpha28: 'rgba(44, 183, 188, 0.28)',
    turquoise700Alpha20: 'rgba(31, 142, 157, 0.2)',
    salmon500Alpha16: 'rgba(255, 109, 95, 0.16)',
    blueAlpha16: 'rgba(13, 127, 255, 0.16)',
    gray900Alpha60: 'rgba(24, 24, 27, 0.6)',
    whiteAlpha12: 'rgba(255, 255, 255, 0.12)',
    whiteAlpha60: 'rgba(255, 255, 255, 0.6)',
    blackAlpha70: 'rgba(0, 0, 0, 0.7)',
} as const
