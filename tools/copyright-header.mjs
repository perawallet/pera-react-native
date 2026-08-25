#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const HEADER = `/*
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

`

const EXTENSIONS = new Set(['.ts', '.tsx'])

const DIRS = ['apps/*/src', 'packages/*/src', 'conformance/src']

function resolveGlob(pattern) {
  const parts = pattern.split('/')
  let paths = ['.']
  for (const part of parts) {
    const next = []
    for (const base of paths) {
      if (part === '*') {
        try {
          for (const entry of readdirSync(base, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              next.push(join(base, entry.name))
            }
          }
        } catch {
          // directory doesn't exist, skip
        }
      } else {
        const candidate = join(base, part)
        try {
          if (statSync(candidate).isDirectory()) {
            next.push(candidate)
          }
        } catch {
          // doesn't exist, skip
        }
      }
    }
    paths = next
  }
  return paths
}

function* walkFiles(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      yield* walkFiles(fullPath)
    } else if (EXTENSIONS.has(extname(entry.name))) {
      yield fullPath
    }
  }
}

function isCopyrightBlock(comment) {
  return /copyright|license/i.test(comment)
}

function extractLeadingBlockComment(content) {
  if (!content.startsWith('/*')) return null
  const end = content.indexOf('*/')
  if (end === -1) return null
  return {
    comment: content.slice(0, end + 2),
    rest: content.slice(end + 2),
  }
}

function processFile(filePath, mode) {
  const content = readFileSync(filePath, 'utf8')
  const headerTrimmed = HEADER.trimEnd()
  const leading = extractLeadingBlockComment(content)

  if (leading) {
    const existingComment = leading.comment
    // Check if the existing comment matches our canonical header
    if (content.startsWith(headerTrimmed)) {
      return false // already correct
    }
    // It's a block comment at the start — check if it's a copyright/license block
    if (mode === 'replace' || isCopyrightBlock(existingComment)) {
      // Replace the old header
      if (mode === 'check') return true // needs fixing
      const rest = leading.rest.replace(/^\n{1,2}/, '') // remove blank lines after old header
      const newContent = HEADER + rest
      writeFileSync(filePath, newContent, 'utf8')
      return true
    }
    // Not a copyright block comment — prepend
    if (mode === 'check') return true
    writeFileSync(filePath, HEADER + content, 'utf8')
    return true
  }

  // No leading block comment at all — prepend
  if (mode === 'check') return true
  writeFileSync(filePath, HEADER + content, 'utf8')
  return true
}

function main() {
  const args = process.argv.slice(2)
  let mode = 'check'
  if (args.includes('--fix')) mode = 'fix'
  if (args.includes('--replace')) mode = 'replace'

  const roots = DIRS.flatMap(resolveGlob)
  let failCount = 0
  let totalCount = 0

  for (const root of roots) {
    for (const filePath of walkFiles(root)) {
      totalCount++
      const changed = processFile(filePath, mode)
      if (changed) {
        failCount++
        if (mode === 'check') {
          console.log(`MISSING: ${filePath}`)
        } else {
          console.log(`FIXED: ${filePath}`)
        }
      }
    }
  }

  if (mode === 'check') {
    if (failCount > 0) {
      console.log(`\n${failCount} of ${totalCount} files have missing or incorrect copyright headers.`)
      console.log('Run "pnpm lint:copyright" to fix them.')
      process.exit(1)
    } else {
      console.log(`All ${totalCount} files have correct copyright headers.`)
    }
  } else {
    if (failCount > 0) {
      console.log(`\nFixed ${failCount} of ${totalCount} files.`)
    } else {
      console.log(`All ${totalCount} files already have correct copyright headers.`)
    }
  }
}

main()
