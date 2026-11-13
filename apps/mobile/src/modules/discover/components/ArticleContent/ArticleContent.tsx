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

import { Fragment, type ReactNode } from 'react'
import { PWText, PWView } from '@components/core'
import {
    toArticleLinkUrl,
    type ArticleBlock,
    type ArticleInline,
    type ArticleText,
} from '../../utils/articleHtml'
import { ArticleImage } from './ArticleImage'
import { useStyles } from './styles'

export type ArticleContentProps = {
    blocks: ArticleBlock[]
    /** Called with a link's href; only links `toArticleLinkUrl` accepts are pressable. */
    onLinkPress: (href: string) => void
    testID?: string
}

const HTTPS_SRC = /^https:\/\//i

const HEADING_VARIANT = {
    1: 'h2',
    2: 'h3',
    3: 'h4',
    4: 'h4',
    5: 'h4',
    6: 'h4',
} as const

const textVariant = (piece: ArticleText) => {
    if (piece.code) return 'mono'
    return piece.bold ? 'bodySemibold' : 'body'
}

export const ArticleContent = ({
    blocks,
    onLinkPress,
    testID,
}: ArticleContentProps) => {
    const styles = useStyles()

    const renderInline = (pieces: ArticleInline[]): ReactNode =>
        pieces.map((piece, index) => {
            if (piece.type === 'break') return '\n'
            if (piece.type === 'link') {
                const children = renderInline(piece.children)
                if (toArticleLinkUrl(piece.href) === null) {
                    return <Fragment key={index}>{children}</Fragment>
                }
                return (
                    <PWText
                        key={index}
                        variant='link'
                        onPress={() => onLinkPress(piece.href)}
                        testID='discover_news_article_link'
                    >
                        {children}
                    </PWText>
                )
            }
            return (
                <PWText
                    key={index}
                    variant={textVariant(piece)}
                    style={piece.italic ? styles.italic : undefined}
                >
                    {piece.value}
                </PWText>
            )
        })

    const renderBlocks = (items: ArticleBlock[]): ReactNode =>
        items.map((block, index) => {
            switch (block.type) {
                case 'heading': {
                    return (
                        <PWText
                            key={index}
                            variant={HEADING_VARIANT[block.level]}
                        >
                            {renderInline(block.children)}
                        </PWText>
                    )
                }
                case 'paragraph': {
                    return (
                        <PWText key={index}>
                            {renderInline(block.children)}
                        </PWText>
                    )
                }
                case 'list': {
                    return (
                        <PWView
                            key={index}
                            style={styles.list}
                        >
                            {block.items.map((item, itemIndex) => (
                                <PWView
                                    key={itemIndex}
                                    style={styles.listItem}
                                >
                                    <PWText style={styles.listMarker}>
                                        {block.ordered
                                            ? `${itemIndex + 1}.`
                                            : '•'}
                                    </PWText>
                                    <PWView style={styles.listBody}>
                                        {renderBlocks(item)}
                                    </PWView>
                                </PWView>
                            ))}
                        </PWView>
                    )
                }
                case 'image': {
                    return HTTPS_SRC.test(block.src) ? (
                        <ArticleImage
                            key={index}
                            src={block.src}
                        />
                    ) : null
                }
                case 'quote': {
                    return (
                        <PWView
                            key={index}
                            style={styles.quote}
                        >
                            {renderBlocks(block.children)}
                        </PWView>
                    )
                }
                case 'code': {
                    return (
                        <PWView
                            key={index}
                            style={styles.code}
                        >
                            <PWText variant='mono'>{block.text}</PWText>
                        </PWView>
                    )
                }
                case 'rule': {
                    return (
                        <PWView
                            key={index}
                            style={styles.rule}
                        />
                    )
                }
            }
        })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            {renderBlocks(blocks)}
        </PWView>
    )
}
