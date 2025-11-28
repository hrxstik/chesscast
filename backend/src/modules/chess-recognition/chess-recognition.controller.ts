import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChessRecognitionService } from './chess-recognition.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

@Controller('chess-recognition')
export class ChessRecognitionController {
  constructor(
    private readonly chessRecognitionService: ChessRecognitionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post(':token/calibrate')
  @UseInterceptors(FileInterceptor('image'))
  async calibrateBoard(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const result = await this.chessRecognitionService.calibrateBoard(
      token,
      file.buffer,
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  }

  @Get(':token/mapping')
  async checkMapping(@Param('token') token: string) {
    const hasMapping = this.chessRecognitionService.hasMapping(token);
    return { hasMapping };
  }
}


