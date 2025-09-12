import { container } from "tsyringe";

export const KeyValueStorageServiceContainerKey = "KeyValueStorageService";

export interface KeyValueStorageService {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  setJSON<T>(key: string, value: T): void;
  getJSON<T>(key: string): T | null;
}

export const useKeyValueStorageService = () => 
    container.resolve<KeyValueStorageService>(KeyValueStorageServiceContainerKey);
