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

import { useState } from 'react'
import { PWImage } from '@components/core'
import { useStyles } from './styles'

export type ArticleImageProps = {
    src: string
}

// Wide enough for most article images until the real size is known.
const DEFAULT_IMAGE_ASPECT = 16 / 9

/** An article image at full width, at its own aspect once it has loaded. */
export const ArticleImage = ({ src }: ArticleImageProps) => {
    const styles = useStyles()
    const [aspectRatio, setAspectRatio] = useState(DEFAULT_IMAGE_ASPECT)

    return (
        <PWImage
            source={{ uri: src }}
            resizeMode='contain'
            style={[styles.image, { aspectRatio }]}
            onLoad={event => {
                const { width, height } = event.source
                if (width > 0 && height > 0) setAspectRatio(width / height)
            }}
        />
    )
}
