import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Request, Response } from 'express';
import { getUploadsDir } from 'src/common/uploads-path';

@Controller('uploads')
export class UploadsController {
  private readonly uploadsDir = getUploadsDir();

  @Get('*')
  serveFile(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace(/^.*?\/uploads\/?/, '').replace(/^\//, '');
    if (!path || path.includes('..')) {
      throw new NotFoundException();
    }
    const filePath = resolve(this.uploadsDir, path);
    if (!filePath.startsWith(resolve(this.uploadsDir))) {
      throw new NotFoundException();
    }
    if (!existsSync(filePath)) {
      throw new NotFoundException();
    }
    res.sendFile(filePath);
  }
}
