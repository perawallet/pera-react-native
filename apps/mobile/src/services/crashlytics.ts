import crashlytics from '@react-native-firebase/crashlytics';
import { CrashlyticsService } from '@perawallet/core';

export class RNCrashlyticsService implements CrashlyticsService {
  initialize(): void {
    crashlytics()
      .setCrashlyticsCollectionEnabled(true)
      .catch(() => {});
  }

  recordNonFatalError(error: unknown): void {
    if (error instanceof Error) {
      crashlytics().recordError(error);
    } else {
      crashlytics().recordError(new Error(String(error)));
    }
  }
}
