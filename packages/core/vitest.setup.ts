import 'reflect-metadata'
import { container } from 'tsyringe'
import { afterEach } from 'vitest'

afterEach(() => {
	try {
		if (typeof (container as any).clearInstances === 'function') {
			;(container as any).clearInstances()
		}
		if (typeof (container as any).reset === 'function') {
			;(container as any).reset()
		}
	} catch {}
})
