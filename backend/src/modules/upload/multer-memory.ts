import { memoryStorage } from 'multer';

/** In-memory storage: sharp и UploadService работают с file.buffer. */
export const multerImageMemory = memoryStorage();

export const multerImageLimits = {
  fileSize: 8 * 1024 * 1024,
};
