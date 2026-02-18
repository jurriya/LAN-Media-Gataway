
export enum FileType {
  FOLDER = 'FOLDER',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}

/** Raw response from GET /api/list */
export interface NasItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  modified_at: number | null;
}

/** UI-friendly media item (derived from NasItem) */
export interface MediaItem {
  id: string;
  name: string;
  type: FileType;
  size: string;
  path: string;
  modified: string;
  thumbnail?: string;
  isFavorite?: boolean;
  rawSize?: number | null;
}

export interface AppSettings {
  apiBaseUrl: string;
  defaultHls: boolean;
  showDownload: boolean;
  theme: 'dark' | 'light';
}

// ── helpers ──

const VIDEO_EXTS = new Set(['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', 'm4v', 'mpg', 'mpeg', '3gp']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'heic']);
const DOC_EXTS   = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf']);

export function inferFileType(filename: string, isDir: boolean): FileType {
  if (isDir) return FileType.FOLDER;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXTS.has(ext)) return FileType.VIDEO;
  if (IMAGE_EXTS.has(ext)) return FileType.IMAGE;
  if (DOC_EXTS.has(ext))   return FileType.DOCUMENT;
  return FileType.OTHER;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function nasItemToMediaItem(item: NasItem): MediaItem {
  const type = inferFileType(item.name, item.is_dir);
  return {
    id: item.path,
    name: item.name,
    type,
    size: formatFileSize(item.size),
    path: item.path,
    modified: formatDate(item.modified_at),
    thumbnail: type === FileType.IMAGE ? `/api/stream?path=${encodeURIComponent(item.path)}` : undefined,
    isFavorite: false,
    rawSize: item.size,
  };
}
