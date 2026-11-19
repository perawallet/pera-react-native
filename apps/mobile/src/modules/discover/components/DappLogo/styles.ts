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

import { makeStyles } from '@rneui/themed'
import {
    DISCOVER_ROW_LEAD_SIZE,
    DISCOVER_TILE_LOGO_SIZE,
} from '../../utils/discoverLayout'

type StyleProps = { size: 'row' | 'tile' }

const SIDE = {
    row: DISCOVER_ROW_LEAD_SIZE,
    tile: DISCOVER_TILE_LOGO_SIZE,
}

export const useStyles = makeStyles((theme, { size }: StyleProps) => {
    const side = SIDE[size]
    return {
        logo: {
            width: side,
            height: side,
            // Figma: rounded squares in rows and the grid.
            borderRadius: theme.borderRadius.md,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
        },
        // Only behind the globe: round logos ship with transparent corners,
        // and a backdrop would show through them.
        placeholder: {
            backgroundColor: theme.colors.layerGray,
        },
    }
})
