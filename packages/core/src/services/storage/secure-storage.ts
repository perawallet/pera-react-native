import { container } from "tsyringe";

export const SecureStorageServiceContainerKey = "SecureStorageService";

export interface SecureStorageService {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  authenticate(): Promise<boolean>;
}

export const useSecureStorageService = () =>
    container.resolve<SecureStorageService>(SecureStorageServiceContainerKey);
