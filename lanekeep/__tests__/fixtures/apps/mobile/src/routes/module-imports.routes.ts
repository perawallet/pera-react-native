/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for the app's navigation root, which is outside every module.
import { AlphaStackNavigator } from '@modules/alpha/routes'
import { AlphaScreen } from '@modules/alpha/screens/AlphaScreen'

export const uses = [AlphaStackNavigator, AlphaScreen]
