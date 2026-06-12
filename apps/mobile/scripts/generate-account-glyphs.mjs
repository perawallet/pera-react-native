/* Extracts glyph-only account icons from the baked SVGs.
   For each accounts/light/*.svg: drop the circular <rect> background and crop
   the viewBox to the 8,8 24x24 live area the glyphs are drawn within.
   unknown-account.svg is already a background-less 24x24 glyph — copied as-is. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '../assets/icons/accounts/light')
const OUT = join(here, '../assets/icons/accounts/glyph')

mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg'))
for (const file of files) {
    let svg = readFileSync(join(SRC, file), 'utf8')

    if (file !== 'unknown-account.svg') {
        // 1) remove the circular background rect (rx="20" only matches the bg)
        svg = svg.replace(/\s*<rect width="40" height="40" rx="20"[^>]*\/>\n?/, '\n')
        if (svg.includes('rx="20"')) {
            throw new Error(
                `${file}: background rect removal failed — rx="20" still present after replace. ` +
                    `Check whether the source SVG's background rect has changed attributes.`,
            )
        }
        // 2) crop to the glyph live area
        svg = svg.replace(
            'width="40" height="40" viewBox="0 0 40 40"',
            'width="24" height="24" viewBox="8 8 24 24"',
        )
        if (!svg.includes('viewBox="8 8 24 24"')) {
            throw new Error(
                `${file}: viewBox crop failed — viewBox="8 8 24 24" not found after replace. ` +
                    `Check whether the source SVG's root element attributes have changed.`,
            )
        }
    }

    writeFileSync(join(OUT, file), svg)
}

console.log(`Generated ${files.length} glyph icons into accounts/glyph/`)
