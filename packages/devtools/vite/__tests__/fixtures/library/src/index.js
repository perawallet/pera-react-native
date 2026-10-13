import { value } from 'declared-dep'
import { peer } from '@scope/peer/deep/path.js'
import { createHash } from 'node:crypto'
import { sibling } from '../../sibling/index.js'

export const all = () => [value, peer, createHash, sibling]
