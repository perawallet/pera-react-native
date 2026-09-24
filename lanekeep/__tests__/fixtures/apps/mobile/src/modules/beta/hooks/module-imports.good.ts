/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for a hook importing other modules through their public entries.
import { AlphaPicker } from '@modules/alpha'
import { AlphaStackNavigator } from '@modules/alpha/routes'
import { AlphaOverlays } from '@modules/alpha/shell'
import { BannerCarousel } from '@modules/banners/carousel'
import { PWWebView } from '@modules/webview/browser'
// Its own module's internals, by alias or relatively, are fine.
import { useBetaStore } from '@modules/beta/stores/useBetaStore'
import { betaRows } from '../utils/rows'
import { AccountDisplay } from '@components/AccountDisplay'

export const uses = [
    AlphaPicker,
    AlphaStackNavigator,
    AlphaOverlays,
    BannerCarousel,
    PWWebView,
    useBetaStore,
    betaRows,
    AccountDisplay,
]
