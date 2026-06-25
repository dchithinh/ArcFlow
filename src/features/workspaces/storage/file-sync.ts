type SyncFile = {
  content: string;
  name: string;
  type: string;
};

type SyncManifest = {
  files: {
    agents: string;
    markdown: string;
    workspaceJson: string;
  };
  hashes: {
    agents: string;
    markdown: string;
    workspaceJson: string;
  };
  updatedAt: string;
  workspaceId: string;
};

export type WorkspaceSyncState =
  | "unlinked"
  | "needs-baseline"
  | "in-sync"
  | "workspace-changed"
  | "files-changed"
  | "conflict";

export type WorkspaceSyncInspection = {
  directoryName: string | null;
  state: WorkspaceSyncState;
};

type FileSystemPermissionMode = "read" | "readwrite";

type PermissionCapableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: FileSystemPermissionMode;
  }) => Promise<PermissionState>;
};

type WindowWithDirectoryPicker = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandle>;
  };

type SyncWorkspaceResult = {
  directoryName: string;
  fileNames: string[];
};

const DB_NAME = "archflow-file-sync";
const STORE_NAME = "workspace-directories";
const MANIFEST_FILE_NAME = ".archflow-sync.json";

const isSupported = (): boolean =>
  typeof window !== "undefined" &&
  "showDirectoryPicker" in window &&
  "indexedDB" in window;

const openDatabase = async (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open sync database."));
  });

const getStoredDirectoryHandle = async (
  workspaceId: string,
): Promise<FileSystemDirectoryHandle | null> => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(workspaceId);

    request.onsuccess = () => {
      resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read stored sync directory."));
    transaction.oncomplete = () => database.close();
  });
};

const storeDirectoryHandle = async (
  workspaceId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, workspaceId);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("Could not store sync directory."));
    transaction.oncomplete = () => database.close();
  });
};

const ensureDirectoryPermission = async (
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode,
): Promise<boolean> => {
  const permissionHandle = handle as PermissionCapableDirectoryHandle;
  const options = { mode };

  if (permissionHandle.queryPermission && (await permissionHandle.queryPermission(options)) === "granted") {
    return true;
  }

  if (permissionHandle.requestPermission) {
    return (await permissionHandle.requestPermission(options)) === "granted";
  }

  return true;
};

const writeFile = async (
  directoryHandle: FileSystemDirectoryHandle,
  file: SyncFile,
): Promise<void> => {
  const fileHandle = await directoryHandle.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([file.content], { type: file.type }));
  await writable.close();
};

const readFile = async (
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string | null> => {
  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
};

const readManifest = async (
  directoryHandle: FileSystemDirectoryHandle,
): Promise<SyncManifest | null> => {
  const content = await readFile(directoryHandle, MANIFEST_FILE_NAME);
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as Partial<SyncManifest>;
  if (
    typeof parsed.workspaceId !== "string" ||
    typeof parsed.files?.workspaceJson !== "string" ||
    typeof parsed.files?.markdown !== "string" ||
    typeof parsed.files?.agents !== "string" ||
    typeof parsed.hashes?.workspaceJson !== "string" ||
    typeof parsed.hashes?.markdown !== "string" ||
    typeof parsed.hashes?.agents !== "string"
  ) {
    return null;
  }

  return {
    files: parsed.files,
    hashes: parsed.hashes,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    workspaceId: parsed.workspaceId,
  };
};

const canReadDirectoryWithoutPrompt = async (
  handle: FileSystemDirectoryHandle | null,
): Promise<boolean> => {
  if (!handle) {
    return false;
  }

  const permissionHandle = handle as PermissionCapableDirectoryHandle;
  if (!permissionHandle.queryPermission) {
    return true;
  }

  return (await permissionHandle.queryPermission({ mode: "read" })) === "granted";
};

const hashString = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
};

const getDirectoryHandle = async (
  workspaceId: string,
  mode: FileSystemPermissionMode,
): Promise<FileSystemDirectoryHandle> => {
  let directoryHandle = await getStoredDirectoryHandle(workspaceId);

  if (!directoryHandle || !(await ensureDirectoryPermission(directoryHandle, mode))) {
    const pickerWindow = window as WindowWithDirectoryPicker;
    if (!pickerWindow.showDirectoryPicker) {
      throw new Error("Directory picker is not available in this browser.");
    }

    directoryHandle = await pickerWindow.showDirectoryPicker({ mode });
    if (!(await ensureDirectoryPermission(directoryHandle, mode))) {
      throw new Error(
        mode === "readwrite"
          ? "Write permission is required to sync files."
          : "Read permission is required to pull synced files.",
      );
    }
    await storeDirectoryHandle(workspaceId, directoryHandle);
  }

  return directoryHandle;
};

export const canSyncWorkspaceFiles = (): boolean => isSupported();

export const syncWorkspaceFiles = async ({
  files,
  manifest,
  workspaceId,
}: {
  files: SyncFile[];
  manifest: SyncManifest["files"];
  workspaceId: string;
}): Promise<SyncWorkspaceResult> => {
  if (!isSupported()) {
    throw new Error("File sync is not supported in this browser.");
  }

  const directoryHandle = await getDirectoryHandle(workspaceId, "readwrite");

  for (const file of files) {
    await writeFile(directoryHandle, file);
  }
  await writeFile(directoryHandle, {
    name: MANIFEST_FILE_NAME,
    content: JSON.stringify(
      {
        workspaceId,
        files: manifest,
        hashes: {
          workspaceJson: hashString(
            files.find((file) => file.name === manifest.workspaceJson)?.content ?? "",
          ),
          markdown: hashString(
            files.find((file) => file.name === manifest.markdown)?.content ?? "",
          ),
          agents: hashString(files.find((file) => file.name === manifest.agents)?.content ?? ""),
        },
        updatedAt: new Date().toISOString(),
      } satisfies SyncManifest,
      null,
      2,
    ),
    type: "application/json;charset=utf-8",
  });

  return {
    directoryName: directoryHandle.name,
    fileNames: files.map((file) => file.name),
  };
};

export const inspectWorkspaceFiles = async ({
  currentFiles,
  fallbackBaseName,
  workspaceId,
}: {
  currentFiles: SyncManifest["hashes"];
  fallbackBaseName: string;
  workspaceId: string;
}): Promise<WorkspaceSyncInspection> => {
  if (!isSupported()) {
    return {
      directoryName: null,
      state: "unlinked",
    };
  }

  const directoryHandle = await getStoredDirectoryHandle(workspaceId);
  if (!(await canReadDirectoryWithoutPrompt(directoryHandle))) {
    return {
      directoryName: null,
      state: "unlinked",
    };
  }

  if (!directoryHandle) {
    return {
      directoryName: null,
      state: "unlinked",
    };
  }

  const manifest = await readManifest(directoryHandle);
  if (!manifest) {
    const fallbackFiles = await Promise.all([
      readFile(directoryHandle, `${fallbackBaseName}.workspace.json`),
      readFile(directoryHandle, `${fallbackBaseName}.md`),
      readFile(directoryHandle, "AGENTS.md"),
    ]);

    return {
      directoryName: directoryHandle.name,
      state: fallbackFiles.some(Boolean) ? "needs-baseline" : "unlinked",
    };
  }

  const workspaceJsonContent = await readFile(directoryHandle, manifest.files.workspaceJson);
  const markdownContent = await readFile(directoryHandle, manifest.files.markdown);
  const agentsContent = await readFile(directoryHandle, manifest.files.agents);
  const filesChanged =
    !workspaceJsonContent ||
    !markdownContent ||
    !agentsContent ||
    hashString(workspaceJsonContent) !== manifest.hashes.workspaceJson ||
    hashString(markdownContent) !== manifest.hashes.markdown ||
    hashString(agentsContent) !== manifest.hashes.agents;
  const workspaceChanged =
    currentFiles.workspaceJson !== manifest.hashes.workspaceJson ||
    currentFiles.markdown !== manifest.hashes.markdown ||
    currentFiles.agents !== manifest.hashes.agents;

  let state: WorkspaceSyncState = "in-sync";
  if (workspaceChanged && filesChanged) {
    state = "conflict";
  } else if (workspaceChanged) {
    state = "workspace-changed";
  } else if (filesChanged) {
    state = "files-changed";
  }

  return {
    directoryName: directoryHandle.name,
    state,
  };
};

export const pullWorkspaceFiles = async ({
  fallbackBaseName,
  workspaceId,
}: {
  fallbackBaseName: string;
  workspaceId: string;
}): Promise<{
  directoryName: string;
  manifestFound: boolean;
  markdown: { content: string; name: string } | null;
  workspaceJson: { content: string; name: string } | null;
}> => {
  if (!isSupported()) {
    throw new Error("File sync is not supported in this browser.");
  }

  const directoryHandle = await getDirectoryHandle(workspaceId, "read");
  const manifest = await readManifest(directoryHandle);
  const workspaceJsonFileName =
    manifest?.files.workspaceJson ?? `${fallbackBaseName}.workspace.json`;
  const markdownFileName = manifest?.files.markdown ?? `${fallbackBaseName}.md`;

  const [workspaceJsonContent, markdownContent] = await Promise.all([
    readFile(directoryHandle, workspaceJsonFileName),
    readFile(directoryHandle, markdownFileName),
  ]);

  if (!workspaceJsonContent && !markdownContent) {
    throw new Error(
      `Could not find ${workspaceJsonFileName} or ${markdownFileName} in the synced folder.`,
    );
  }

  return {
    directoryName: directoryHandle.name,
    manifestFound: Boolean(manifest),
    workspaceJson: workspaceJsonContent
      ? { content: workspaceJsonContent, name: workspaceJsonFileName }
      : null,
    markdown: markdownContent ? { content: markdownContent, name: markdownFileName } : null,
  };
};
