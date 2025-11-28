import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

@Injectable()
export class ChessRecognitionService {
  private readonly logger = new Logger(ChessRecognitionService.name);
  private readonly mappingsDir = join(process.cwd(), 'chessboard_mappings');
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    // Создание директории для маппингов
    this.ensureMappingsDir();
  }

  private async ensureMappingsDir() {
    if (!existsSync(this.mappingsDir)) {
      await mkdir(this.mappingsDir, { recursive: true });
    }
  }

  /**
   * Калибровка доски - сохранение изображения для обработки Python скриптом
   */
  async calibrateBoard(
    gameToken: string,
    imageBuffer: Buffer,
  ): Promise<{ success: boolean; message: string; mappingData?: any }> {
    try {
      // Сохранение изображения во временный файл
      const tempImagePath = join(
        this.mappingsDir,
        `${gameToken}_calibration.jpg`,
      );

      await writeFile(tempImagePath, imageBuffer);

      // Запуск Python скрипта для калибровки
      // Путь относительно корня проекта (не backend/)
      // process.cwd() может быть backend/ или корень проекта
      const cwd = process.cwd();
      const projectRoot =
        cwd.endsWith('backend') ||
        cwd.endsWith('backend\\') ||
        cwd.endsWith('backend/')
          ? join(cwd, '..')
          : cwd;
      const pythonScript = join(
        projectRoot,
        'chess-recognition',
        'src',
        'calibrate_board.py',
      );

      const pythonProcess = spawn('python', [
        pythonScript,
        '--token',
        gameToken,
        '--image',
        tempImagePath,
        '--mappings-dir',
        this.mappingsDir,
      ]);

      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              // Чтение результата маппинга
              const mappingPath = join(
                this.mappingsDir,
                `${gameToken}_mapping.json`,
              );
              if (existsSync(mappingPath)) {
                const mappingData = require(mappingPath);
                resolve({
                  success: true,
                  message: 'Board calibrated successfully',
                  mappingData,
                });
              } else {
                resolve({
                  success: false,
                  message: 'Mapping file not created',
                });
              }
            } catch (error) {
              this.logger.error('Error reading mapping file', error);
              resolve({
                success: false,
                message: 'Error reading mapping result',
              });
            }
          } else {
            this.logger.error(`Calibration failed: ${stderr}`);
            resolve({
              success: false,
              message: `Calibration failed: ${stderr}`,
            });
          }
        });
      });
    } catch (error) {
      this.logger.error('Error in calibrateBoard', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Запуск обработки потока для игры
   */
  startStreamProcessing(
    gameToken: string,
    modelPath: string,
    onFrameProcessed: (result: any) => void,
    onError: (error: Error) => void,
  ): void {
    if (this.activeProcesses.has(gameToken)) {
      this.logger.warn(
        `Stream processing already active for token ${gameToken}`,
      );
      return;
    }

    // Путь относительно корня проекта (не backend/)
    // process.cwd() может быть backend/ или корень проекта
    const cwd = process.cwd();
    const projectRoot =
      cwd.endsWith('backend') ||
      cwd.endsWith('backend\\') ||
      cwd.endsWith('backend/')
        ? join(cwd, '..')
        : cwd;
    const pythonScript = join(
      projectRoot,
      'chess-recognition',
      'src',
      'stream_server.py',
    );

    const pythonProcess = spawn('python', [
      pythonScript,
      '--token',
      gameToken,
      '--model',
      modelPath,
      '--mappings-dir',
      this.mappingsDir,
    ]);

    let buffer = '';

    pythonProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const result = JSON.parse(line);
            onFrameProcessed(result);
          } catch (error) {
            this.logger.warn('Failed to parse result', line);
          }
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const errorText = data.toString();
      // Фильтруем предупреждения (warnings), которые не являются критическими ошибками
      if (
        errorText.includes('UserWarning') ||
        errorText.includes('pkg_resources is deprecated') ||
        errorText.includes('Warning:') ||
        (errorText.trim().startsWith('C:\\') &&
          errorText.includes('UserWarning'))
      ) {
        // Это предупреждение, логируем как debug, но не как ошибку
        this.logger.debug(`Python warning: ${errorText}`);
        return;
      }
      // Реальные ошибки логируем и отправляем
      this.logger.error(`Stream processing error: ${errorText}`);
      onError(new Error(errorText));
    });

    pythonProcess.on('close', (code) => {
      this.activeProcesses.delete(gameToken);
      this.logger.log(`Stream processing stopped for token ${gameToken}`);
    });

    this.activeProcesses.set(gameToken, pythonProcess);
  }

  /**
   * Отправка кадра в процесс обработки (бинарные данные)
   */
  sendFrame(gameToken: string, frameData: Buffer): void {
    const pythonProcess = this.activeProcesses.get(gameToken);
    if (!pythonProcess) {
      throw new Error(`No active stream processing for token ${gameToken}`);
    }

    // Отправка бинарных данных: длина (4 байта) + данные
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(frameData.length, 0);

    // Отправка длины и данных
    pythonProcess.stdin?.write(lengthBuffer);
    pythonProcess.stdin?.write(frameData);
  }

  /**
   * Остановка обработки потока
   */
  stopStreamProcessing(gameToken: string): void {
    const pythonProcess = this.activeProcesses.get(gameToken);
    if (pythonProcess) {
      pythonProcess.kill();
      this.activeProcesses.delete(gameToken);
      this.logger.log(`Stream processing stopped for token ${gameToken}`);
    }
  }

  /**
   * Проверка наличия маппинга для токена
   */
  hasMapping(gameToken: string): boolean {
    const mappingPath = join(this.mappingsDir, `${gameToken}_mapping.json`);
    return existsSync(mappingPath);
  }
}
