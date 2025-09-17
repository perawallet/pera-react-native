import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import {
	CrashReportingServiceContainerKey,
	useCrashReportingService,
	type CrashReportingService,
} from '@services/reporting'

describe('services/reporting/platform-service', () => {
	test('useCrashReportingService resolves the registered CrashReportingService from the container', () => {
		const dummy: CrashReportingService = {
			initializeCrashReporting: vi.fn(),
			recordNonFatalError: vi.fn(),
		}

		container.register(CrashReportingServiceContainerKey, { useValue: dummy })

		const svc = useCrashReportingService()
		expect(svc).toBe(dummy)

		svc.initializeCrashReporting()
		expect(dummy.initializeCrashReporting).toHaveBeenCalledTimes(1)
	})
})
