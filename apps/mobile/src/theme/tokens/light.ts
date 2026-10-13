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

export const lightColorTokens = {
    // @rneui built-ins (kept for internal use)
    primary: palette.gray[800],
    secondary: palette.purple[600],
    background: palette.white,
    black: palette.gray[900],
    white: palette.white,
    grey0: palette.gray[50],
    grey1: palette.gray[100],
    grey2: palette.gray[200],
    grey3: palette.gray[300],
    grey4: palette.gray[400],
    grey5: palette.gray[500],
    success: palette.turquoise[600],
    warning: palette.yellow[400],
    error: palette.salmon[600],
    divider: 'rgba(0,0,0,0.05)',

    // Defaults
    systemElements: palette.black,

    // Text
    textGray: palette.gray[500],
    textGrayLighter: palette.gray[400],
    textMain: palette.gray[900],
    textWhite: palette.white,

    // Layer
    layerGray: palette.gray[200],
    layerGrayLighter: palette.gray[100],
    layerGrayLightest: palette.gray[50],

    // Drawer overlay — shades the covered screen. An order of magnitude
    // lighter than a modal backdrop: the content should read as sitting
    // under the panel, not dimmed out of use.
    drawerScrim: 'rgba(0, 0, 0, 0.3)',

    // Warning surface — gold #EDB21C tint for the attention callout
    warningSurface: 'rgba(237, 178, 28, 0.06)',

    // Link
    linkPrimary: palette.turquoise[700],
    linkIcon: palette.turquoise[600],

    // Button Primary
    buttonPrimaryBg: palette.gray[800],
    buttonPrimaryText: palette.white,
    buttonPrimaryFocusBg: palette.gray[900],
    buttonPrimaryDisabledBg: palette.gray[100],
    buttonPrimaryDisabledText: palette.gray[500],

    // Button New Primary
    buttonNewPrimaryBg: palette.purple[600],
    buttonNewPrimaryText: palette.white,
    buttonNewPrimaryFocusBg: palette.purple[700],
    buttonNewPrimaryDisabledBg: palette.gray[100],
    buttonNewPrimaryDisabledText: palette.gray[500],

    // Button Secondary
    buttonSecondaryBg: palette.gray[100],
    buttonSecondaryFocusBg: palette.gray[200],
    buttonSecondaryDisabledBg: palette.gray[100],
    buttonSecondaryText: palette.gray[900],
    buttonSecondaryDisabledText: palette.gray[500],

    // Button Ghost
    buttonGhostBg: palette.white,
    buttonGhostFocusBg: palette.gray[100],
    buttonGhostDisabledBg: palette.white,
    buttonGhostText: palette.gray[900],
    buttonGhostDisabledText: palette.gray[500],

    // Button Float
    buttonFloatBg: palette.white,
    buttonFloatFocusBg: palette.gray[100],
    buttonFloatIconMain: palette.gray[900],
    buttonFloatIconLighter: palette.white,

    // Button Helper
    buttonHelperBg: palette.gray[800],
    buttonHelperFocusBg: palette.gray[700],
    buttonHelperDisabledBg: palette.gray[100],
    buttonHelperIcon: palette.white,
    buttonHelperDisabledIcon: palette.gray[500],
    buttonHelperPeraIcon: palette.yellow[400],

    // Button Square
    buttonSquareBg: tints.turquoise600Alpha12,
    buttonSquareFocusBg: tints.turquoise600Alpha28,
    buttonSquareSecondaryBg: palette.gray[100],
    buttonSquareIcon: palette.turquoise[700],
    buttonSquareSecondaryIcon: palette.gray[500],

    // Helpers
    positive: palette.turquoise[700],
    positiveLighter: palette.turquoise[100],
    negative: palette.salmon[600],
    negativeLighter: palette.salmon[100],
    warningText: palette.yellow[600],
    successCheckmark: palette.white,
    heroBg: palette.gray[50],

    // Banner
    bannerContentBg: palette.gray[700],
    bannerBg: palette.turquoise[200],
    bannerButton: tints.whiteAlpha12,
    bannerIconBg: tints.turquoise700Alpha20,
    bannerText: palette.turquoise[900],

    // Alert
    alertNegative: palette.salmon[600],
    alertContent: palette.white,
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
    wallet4IconGovernor: palette.turquoise[700],
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
    trustedIconInline: palette.white,
    verifiedIconBg: '#CEEEFE',
    verifiedIconInline: accentPalette.blue,
    verifiedIconSolidBg: accentPalette.blue,
    verifiedIconSolidInline: palette.white,
    suspiciousIconBg: palette.salmon[500],
    suspiciousIconInline: palette.white,

    // ASA Banners
    trustedBannerContent: palette.turquoise[700],
    trustedBannerBg: tints.turquoise600Alpha16,
    verifiedBannerContent: accentPalette.blue,
    verifiedBannerBg: tints.blueAlpha16,
    suspiciousBannerContent: palette.salmon[600],
    suspiciousBannerBg: tints.salmon500Alpha16,

    // Staking Badges
    stakingLiquidBadge: accentPalette.stakingLiquid,
    stakingPoolsBadge: accentPalette.stakingPools,
    stakingDelegatedBadge: accentPalette.stakingDelegated,

    // Toast
    toastBg: 'rgba(24, 24, 27, 0.9)',
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
    backdropModalBg: 'rgba(0, 0, 0, 0.64)',

    // Keyboard
    keyboardAccessoryBg: '#D1D5DB',
    keyboardAccessoryLine: '#C7C8CC',

    // Tab Bar
    tabBarButton: palette.gray[800],
    tabBarBg: 'rgba(255, 255, 255, 0.84)',
    tabBarIconActive: palette.gray[900],
    tabBarIconNonActive: palette.gray[400],
    tabBarIconDisabled: 'rgba(161, 161, 170, 0.5)',

    // Bottom Sheet
    bottomSheetLine: '#E6E7E9',

    // Modality
    modalityBg: palette.gray[900],

    // Switches
    switchBg: palette.turquoise[600],
    switchOffBg: palette.gray[400],

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
