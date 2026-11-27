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

import { PWIcon, PWImage, PWView } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useDappLogo } from './useDappLogo'

const GLOBE_SIZE = { row: undefined, tile: 'lg' } as const

export type DappLogoProps = {
    logo: Nullable<string>
    /** `row`: a list row's leading logo; `tile`: the home grid. */
    size?: 'row' | 'tile'
    /**
     * The dApp's page, asked for its own icon when there is no logo. Only for
     * a dApp the user chose to keep: each try is a request to that site.
     */
    siteUrl?: string
}

/** A dApp's logo, else its site's icon when asked for, else a globe. */
export const DappLogo = ({ logo, size = 'row', siteUrl }: DappLogoProps) => {
    const styles = useStyles({ size })
    const { uri, handleError } = useDappLogo({ logo, siteUrl })
    return uri ? (
        <PWImage
            source={{ uri }}
            style={styles.logo}
            onError={handleError}
        />
    ) : (
        <PWView style={[styles.logo, styles.placeholder]}>
            <PWIcon
                name='globe'
                size={GLOBE_SIZE[size]}
                variant='secondary'
            />
        </PWView>
    )
}
