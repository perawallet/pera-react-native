/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for a hook in one module reaching into another's internals.
import { AlphaPicker } from '@modules/alpha/components/AlphaPicker'
import type { AlphaRow } from '@modules/alpha/utils/rows'
import { alphaRows } from '../../alpha/utils/rows'
import { AlphaScreen } from '@modules/alpha/screens/AlphaScreen'
import { alphaWebOnly } from '@modules/alpha/web'

export { useAlpha } from '@modules/alpha/hooks/useAlpha'

export const load = () => import('@modules/alpha/components/AlphaSheet')

export const uses = [
    AlphaPicker,
    alphaRows,
    AlphaScreen,
    alphaWebOnly,
    null as unknown as AlphaRow,
]
