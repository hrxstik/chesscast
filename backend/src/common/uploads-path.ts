import { join } from 'path';

/** Единый каталог uploads относительно cwd процесса Nest (обычно `backend/`). */
export function getUploadsDir(): string {
  return join(process.cwd(), 'uploads');
}
