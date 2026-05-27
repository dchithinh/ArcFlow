import type { FirmwareDesign } from "../schema/firmware-design";

const STORAGE_KEY = "archflow.designs.v1";

type StoredPayload = {
  version: 1;
  designs: FirmwareDesign[];
};

const isBrowser = typeof window !== "undefined";

export const loadDesigns = (): FirmwareDesign[] => {
  if (!isBrowser) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredPayload;
    return Array.isArray(parsed.designs) ? parsed.designs : [];
  } catch {
    return [];
  }
};

export const saveDesigns = (designs: FirmwareDesign[]): void => {
  if (!isBrowser) {
    return;
  }

  const payload: StoredPayload = {
    version: 1,
    designs,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};
