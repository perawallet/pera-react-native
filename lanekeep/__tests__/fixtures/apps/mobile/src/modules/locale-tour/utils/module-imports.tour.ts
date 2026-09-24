/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for the locale tour, which may read the gallery catalog and nothing else.
import { getScreenSections } from '@modules/settings/screens/developer/gallery-catalog'
import { AlphaSheet } from '@modules/alpha/components/AlphaSheet'

export const uses = [getScreenSections, AlphaSheet]
