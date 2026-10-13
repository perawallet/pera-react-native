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

import { accentPalette, palette, tints } from '../colors'
import type { ColorTokens } from './types'

export const darkColorTokens = {
    // @rneui built-ins (kept for internal use)
    primary: palette.yellow[400],
    secondary: palette.purple[400],
    background: palette.gray[900],
    black: palette.white,
    white: palette.gray[100],
    grey0: palette.gray[800],
    grey1: palette.gray[800],
    grey2: palette.gray[700],
    grey3: palette.gray[700],
    grey4: palette.gray[500],
    grey5: palette.gray[500],
    success: palette.yellow[400],
    warning: '#b66129',
    error: palette.salmon[500],
    divider: 'rgba(255, 255, 255, 0.05)',

    // Defaults
    systemElements: palette.white,

    // Text
    textGray: palette.gray[400],
    textGrayLighter: palette.gray[500],
    textMain: palette.gray[100],
    textWhite: palette.white,

    // Layer
    layerGray: palette.gray[700],
    layerGrayLighter: palette.gray[800],
    layerGrayLightest: palette.gray[800],

    // Inverted, and far weaker: darkening gray[900] is invisible, so the
    // covered screen is lifted instead. Alpha is the dial to turn if the
    // two layers still read as one.
    drawerScrim: 'rgba(255, 255, 255, 0.08)',

    // Warning surface — gold #EDB21C tint for the attention callout
    warningSurface: 'rgba(237, 178, 28, 0.1)',

    // Link
    linkPrimary: palette.yellow[400],
    linkIcon: palette.gray[100],

    // Button Primary
    buttonPrimaryBg: palette.yellow[400],
    buttonPrimaryText: palette.gray[900],
    buttonPrimaryFocusBg: palette.yellow[500],
    buttonPrimaryDisabledBg: palette.gray[800],
    buttonPrimaryDisabledText: palette.gray[500],

    // Button New Primary
    buttonNewPrimaryBg: palette.purple[400],
    buttonNewPrimaryText: palette.gray[900],
    buttonNewPrimaryFocusBg: palette.purple[500],
    buttonNewPrimaryDisabledBg: palette.gray[800],
    buttonNewPrimaryDisabledText: palette.gray[500],

    // Button Secondary
    buttonSecondaryBg: palette.gray[800],
    buttonSecondaryFocusBg: palette.gray[900],
    buttonSecondaryDisabledBg: palette.gray[800],
    buttonSecondaryText: palette.gray[100],
    buttonSecondaryDisabledText: palette.gray[500],

    // Button Ghost
    buttonGhostBg: palette.gray[900],
    buttonGhostFocusBg: palette.gray[800],
    buttonGhostDisabledBg: palette.gray[900],
    buttonGhostText: palette.gray[100],
    buttonGhostDisabledText: palette.gray[500],

    // Button Float
    buttonFloatBg: palette.white,
    buttonFloatFocusBg: palette.gray[100],
    buttonFloatIconMain: palette.gray[900],
    buttonFloatIconLighter: '#17171A',

    // Button Helper
    buttonHelperBg: 'rgba(255, 238, 85, 0.1)',
    buttonHelperFocusBg: 'rgba(255, 238, 85, 0.2)',
    buttonHelperDisabledBg: 'rgba(255, 238, 85, 0.05)',
    buttonHelperIcon: palette.yellow[400],
    buttonHelperDisabledIcon: 'rgba(255, 238, 85, 0.5)',
    buttonHelperPeraIcon: palette.yellow[400],

    // Button Square
    buttonSquareBg: tints.turquoise600Alpha12,
    buttonSquareFocusBg: tints.turquoise600Alpha28,
    buttonSquareSecondaryBg: palette.gray[800],
    buttonSquareIcon: palette.turquoise[600],
    buttonSquareSecondaryIcon: palette.gray[500],

    // Helpers
    positive: palette.turquoise[600],
    positiveLighter: tints.turquoise600Alpha12,
    negative: palette.salmon[500],
    negativeLighter: 'rgba(255, 109, 95, 0.12)',
    warningText: palette.yellow[600],
    successCheckmark: palette.gray[900],
    heroBg: '#1D1D21',

    // Banner
    bannerContentBg: palette.gray[700],
    bannerBg: palette.turquoise[200],
    bannerButton: tints.whiteAlpha12,
    bannerIconBg: tints.turquoise700Alpha20,
    bannerText: palette.turquoise[900],

    // Alert
    alertNegative: palette.salmon[500],
    alertContent: palette.gray[900],
    alertPositive: palette.turquoise[600],

    // Wallet
    wallet1: palette.blush[600],
    wallet1Icon: accentPalette.magenta,
    wallet2: palette.salmon[500],
    wallet2Icon: accentPalette.cream,
    wallet3: palette.purple[500],
    wallet3Icon: accentPalette.pink,
    wallet3IconGovernor: palette.purple[500],
    wallet4: palette.turquoise[300],
    wallet4Icon: palette.turquoise[800],
    wallet4IconGovernor: palette.turquoise[600],
    wallet5: palette.salmon[400],
    wallet5Icon: accentPalette.navy,

    // Account Icons
    accountIconTurquoiseBg: palette.turquoise[300],
    accountIconPurpleBg: accentPalette.violet,
    accountIconMagentaBg: accentPalette.magenta,
    accountIconPinkBg: accentPalette.rose,
    accountIconPeachBg: palette.salmon[100],
    accountIconNeutralBg: palette.gray[100],
    accountIconQuantumBg: palette.turquoise[300],

    // ASA Icons
    trustedIconBg: palette.turquoise[600],
    trustedIconInline: palette.gray[900],
    verifiedIconBg: accentPalette.blueLight,
    verifiedIconInline: palette.gray[900],
    verifiedIconSolidBg: accentPalette.blueLight,
    verifiedIconSolidInline: palette.gray[900],
    suspiciousIconBg: palette.salmon[500],
    suspiciousIconInline: palette.gray[900],

    // ASA Banners
    trustedBannerContent: palette.turquoise[600],
    trustedBannerBg: tints.turquoise600Alpha16,
    verifiedBannerContent: accentPalette.blueLight,
    verifiedBannerBg: tints.blueAlpha16,
    suspiciousBannerContent: palette.salmon[500],
    suspiciousBannerBg: tints.salmon500Alpha16,

    // Staking Badges
    stakingLiquidBadge: accentPalette.stakingLiquid,
    stakingPoolsBadge: accentPalette.stakingPools,
    stakingDelegatedBadge: accentPalette.stakingDelegated,

    // Toast
    toastBg: 'rgba(82, 82, 91, 0.92)',
    toastTitle: palette.white,
    toastDescription: tints.whiteAlpha60,

    // Testnet
    testnetBg: palette.yellow[500],
    testnetText: palette.gray[900],

    // Algo Icon
    algoIconBg: palette.black,
    algoIcon: palette.white,

    // QR Scanner
    qrScannerBg: tints.blackAlpha70,

    // Backdrop
    backdropModalBg: 'rgba(0, 0, 0, 0.86)',

    // Keyboard
    keyboardAccessoryBg: '#292929',
    keyboardAccessoryLine: '#393939',

    // Tab Bar
    tabBarButton: palette.gray[800],
    tabBarBg: 'rgba(24, 24, 27, 0.84)',
    tabBarIconActive: palette.gray[50],
    tabBarIconNonActive: palette.gray[500],
    tabBarIconDisabled: 'rgba(113, 113, 122, 0.5)',

    // Bottom Sheet
    bottomSheetLine: palette.gray[700],

    // Modality
    modalityBg: palette.black,

    // Switches
    switchBg: palette.yellow[500],
    switchOffBg: palette.gray[800],

    // NFT Icon
    nftIconBg: tints.gray900Alpha60,
    nftIcon: palette.white,

    // Dapp
    dappMoonpay: accentPalette.moonpay,
    dappSardine: accentPalette.sardine,
    dappTransak: accentPalette.transak,
    dappBidali: accentPalette.bidali,

    // Legacy (no Figma equivalent)
    favorite: palette.yellow[500],
} satisfies ColorTokens
