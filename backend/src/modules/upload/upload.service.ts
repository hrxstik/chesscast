import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { getUploadsDir } from 'src/common/uploads-path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private uploadBaseDir = getUploadsDir();

  async saveFile(
    file: Express.Multer.File,
    folder: 'organizations-avatars' | 'users-avatars' | '' = '',
  ): Promise<string> {
    try {
      const uploadDir = folder
        ? path.join(this.uploadBaseDir, folder)
        : this.uploadBaseDir;
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `${crypto.randomUUID()}.jpg`;
      const filepath = path.join(uploadDir, filename);

      const input =
        file.buffer ??
        (file.path ? await fs.readFile(file.path) : null);
      if (!input?.length) {
        throw new Error('Empty file buffer');
      }

      const buffer = await sharp(input)
        .rotate()
        .resize({ width: 256, height: 256, fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();

      await fs.writeFile(filepath, buffer);

      const servingPath = folder
        ? `/uploads/${folder}/${filename}`
        : `/uploads/${filename}`;

      return servingPath;
    } catch (error) {
      this.logger.error('saveFile failed', error);
      throw new InternalServerErrorException('Не удалось сохранить файл');
    }
  }
}
