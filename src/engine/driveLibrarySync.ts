import { StudioJsonLibrary } from '../types/studio';
import { getAccessToken } from '../lib/firebaseAuth';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
export const STUDIO_LIBRARY_FILENAME = 'monolith_studio_library.json';

export interface DriveFileSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

function requireToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Drive session expired or not signed in.');
  }
  return token;
}

export async function findStudioLibraryFiles(): Promise<DriveFileSummary[]> {
  const token = requireToken();
  const q = encodeURIComponent(
    `name = '${STUDIO_LIBRARY_FILENAME}' and trashed = false`
  );
  const res = await fetch(
    `${DRIVE_FILES_API}?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive query failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

export async function readStudioLibraryFromDrive(
  fileId: string
): Promise<StudioJsonLibrary> {
  const token = requireToken();
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive read failed (${res.status}): ${text}`);
  }
  return (await res.json()) as StudioJsonLibrary;
}

export async function createStudioLibraryInDrive(
  library: StudioJsonLibrary
): Promise<DriveFileSummary> {
  const token = requireToken();
  const metadata = {
    name: STUDIO_LIBRARY_FILENAME,
    mimeType: 'application/json',
    description:
      'Monolith Noir 3D Analog Studio Rack JSON Library built by 100 Dragonfly Digital Architects.',
  };

  const boundary = '-------monolith_studio_boundary_9d';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(library, null, 2)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive create failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DriveFileSummary;
}

export async function updateStudioLibraryInDrive(
  fileId: string,
  library: StudioJsonLibrary
): Promise<DriveFileSummary> {
  const token = requireToken();
  const res = await fetch(
    `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(library, null, 2),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive update failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DriveFileSummary;
}

export async function deleteStudioLibraryInDrive(fileId: string): Promise<void> {
  const token = requireToken();
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive delete failed (${res.status}): ${text}`);
  }
}
