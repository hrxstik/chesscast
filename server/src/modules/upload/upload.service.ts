import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
@Injectable()
export class UploadService {
  private uploadBaseDir = path.join(process.cwd(), 'uploads');

  async saveFile(
    file: Express.Multer.File,
    folder: 'organizations-avatars' | 'users-avatars' | '' = '',
  ): Promise<string> {
    try {
      const ext = path.extname(file.originalname);
      const filename = `${uuidv4()}${ext}`;

      const uploadDir = folder
        ? path.join(this.uploadBaseDir, folder)
        : this.uploadBaseDir;

      const filepath = path.join(uploadDir, filename);

      const buffer = await sharp(file.buffer)
        .resize({ height: 256 })
        .png({ quality: 80 })
        .toBuffer();

      await fs.writeFile(filepath, buffer);

      const servingPath = `/uploads/${folder}/${filename}`
        ? `/uploads/${folder}/${filename}`
        : `/uploads/${filename}`;

      return servingPath;
    } catch (error) {
      throw new InternalServerErrorException('Error saving file');
    }
  }
}
