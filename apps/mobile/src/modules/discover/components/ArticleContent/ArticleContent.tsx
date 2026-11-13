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
import type { TypographyVariant } from '@theme/typography'
import {
    toArticleLinkUrl,
    type ArticleBlock,
    type ArticleInline,
} from '../../utils/articleHtml'
import { articleRunStyle } from '../../utils/articleRunStyle'
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

export const ArticleContent = ({
    blocks,
    onLinkPress,
    testID,
}: ArticleContentProps) => {
    const styles = useStyles()

    // Each run inherits from the Text around it (block or link), see articleRunStyle.
    const renderInline = (
        pieces: ArticleInline[],
        base: TypographyVariant,
        inLink: boolean,
    ): ReactNode =>
        pieces.map((piece, index) => {
            if (piece.type === 'break') return '\n'
            if (piece.type === 'link') {
                if (toArticleLinkUrl(piece.href) === null) {
                    return (
                        <Fragment key={index}>
                            {renderInline(piece.children, base, inLink)}
                        </Fragment>
                    )
                }
                return (
                    <PWText
                        key={index}
                        variant={base}
                        style={styles.link}
                        onPress={() => onLinkPress(piece.href)}
                        testID='discover_news_article_link'
                    >
                        {renderInline(piece.children, base, true)}
                    </PWText>
                )
            }
            const look = articleRunStyle(piece, base, inLink)
            if (look.plain) {
                return <Fragment key={index}>{piece.value}</Fragment>
            }
            return (
                <PWText
                    key={index}
                    variant={look.variant}
                    weight={look.weight}
                    style={[
                        look.italic && styles.italic,
                        look.link && styles.link,
                    ]}
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
                            {renderInline(
                                block.children,
                                HEADING_VARIANT[block.level],
                                false,
                            )}
                        </PWText>
                    )
                }
                case 'paragraph': {
                    return (
                        <PWText key={index}>
                            {renderInline(block.children, 'body', false)}
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
