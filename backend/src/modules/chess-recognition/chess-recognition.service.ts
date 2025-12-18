import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';

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

      // Путь к модели YOLO11 для калибровки по фигурам
      const defaultModelPath =
        process.env.YOLO_MODEL_PATH ||
        join(projectRoot, 'chess-recognition', 'bestmerged.pt');

      const pythonProcess = spawn('python', [
        pythonScript,
        '--token',
        gameToken,
        '--image',
        tempImagePath,
        '--mappings-dir',
        this.mappingsDir,
        '--model',
        defaultModelPath,
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
   * Ручная калибровка по углам, заданным с фронта
   */
  async manualCalibrateBoard(
    gameToken: string,
    imageBuffer: Buffer,
    corners: { x: number; y: number }[],
  ): Promise<{ success: boolean; message: string; mappingData?: any }> {
    try {
      if (!corners || corners.length !== 4) {
        return {
          success: false,
          message: 'Exactly 4 corners are required for manual calibration',
        };
      }

      // Сохранение изображения во временный файл
      const tempImagePath = join(
        this.mappingsDir,
        `${gameToken}_manual_calibration.jpg`,
      );

      await writeFile(tempImagePath, imageBuffer);

      // Путь к Python-скрипту
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

      // Преобразуем углы в плоский массив [x1,y1,x2,y2,x3,y3,x4,y4]
      const cornersArgs = corners
        .map((c) => [c.x.toString(), c.y.toString()])
        .flat();

      const pythonProcess = spawn('python', [
        pythonScript,
        '--token',
        gameToken,
        '--image',
        tempImagePath,
        '--mappings-dir',
        this.mappingsDir,
        '--corners',
        ...cornersArgs,
      ]);

      return new Promise((resolve) => {
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
              const mappingPath = join(
                this.mappingsDir,
                `${gameToken}_mapping.json`,
              );
              if (existsSync(mappingPath)) {
                const mappingData = require(mappingPath);
                resolve({
                  success: true,
                  message: 'Board manually calibrated successfully',
                  mappingData,
                });
              } else {
                resolve({
                  success: false,
                  message: 'Mapping file not created in manual calibration',
                });
              }
            } catch (error) {
              this.logger.error(
                'Error reading mapping file after manual calibration',
                error,
              );
              resolve({
                success: false,
                message:
                  'Error reading mapping result after manual calibration',
              });
            }
          } else {
            this.logger.error(`Manual calibration failed: ${stderr}`);
            resolve({
              success: false,
              message: `Manual calibration failed: ${stderr}`,
            });
          }
        });
      });
    } catch (error) {
      this.logger.error('Error in manualCalibrateBoard', error);
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

    // Преобразуем путь к маппингам в абсолютный, чтобы Python скрипт точно нашел файлы
    const absoluteMappingsDir = join(process.cwd(), 'chessboard_mappings');

    this.logger.log(
      `📹 Starting stream processing for token ${gameToken}, mappings dir: ${absoluteMappingsDir}`,
    );

    const pythonProcess = spawn(
      'python',
      [
      pythonScript,
      '--token',
      gameToken,
      '--model',
      modelPath,
      '--mappings-dir',
        absoluteMappingsDir,
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr - все через pipe
      },
    );

    // Логируем запуск процесса
    this.logger.log(
      `🐍 Python process spawned: PID=${pythonProcess.pid}, script=${pythonScript}`,
    );

    let stdoutBuffer = '';
    let stderrBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

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
      const rawData = data.toString();
      stderrBuffer += rawData;
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // Логируем важные сообщения из Python (инициализация, детекция ходов, запуск)
        if (
          line.includes('[STARTUP]') ||
          line.includes('[INIT]') ||
          (line.includes('[MOVE]') && !line.includes('[MOVE-DEBUG]'))
        ) {
          this.logger.log(`🐍 [PYTHON] ${line.trim()}`);
        } else if (line.includes('[DETECTION]')) {
          // Детекции логируем как debug, чтобы не спамить
          this.logger.debug(`🐍 [PYTHON] ${line.trim()}`);
        } else if (
          line.includes('[STABILIZATION]') ||
          line.includes('[MOVE-DEBUG]') ||
          line.includes('[VISUALIZATION]')
        ) {
          // Отладочные логи логируем как debug
          this.logger.debug(`🐍 [PYTHON] ${line.trim()}`);
        } else if (
          line.includes('UserWarning') ||
          line.includes('pkg_resources is deprecated') ||
          line.includes('Warning:') ||
          (line.trim().startsWith('C:\\') && line.includes('UserWarning'))
      ) {
        // Это предупреждение, логируем как debug, но не как ошибку
          this.logger.debug(`Python warning: ${line.trim()}`);
        } else if (
          line.includes('Traceback') ||
          line.includes('Error:') ||
          line.includes('Exception:') ||
          line.includes('NameError') ||
          line.includes('TypeError') ||
          line.includes('ValueError') ||
          line.includes('File "') ||
          line.trim().startsWith('  File ')
        ) {
          // Реальные ошибки Python логируем и отправляем
          this.logger.error(`Stream processing error: ${line.trim()}`);
          onError(new Error(line.trim()));
        } else {
          // Неизвестные логи логируем как debug (возможно, это просто информационные сообщения)
          this.logger.debug(`🐍 [PYTHON] ${line.trim()}`);
        }
      }
    });

    // Логируем ошибки запуска процесса
    pythonProcess.on('error', (error) => {
      this.logger.error(`🐍 Python process error: ${error.message}`);
      onError(error);
    });

    // Обработка ошибок записи в stdin (EOF и т.д.)
    if (pythonProcess.stdin) {
      pythonProcess.stdin.on('error', (error: NodeJS.ErrnoException) => {
        // Игнорируем ошибки EOF - это нормально, когда процесс закрывается
        if (error.code !== 'EOF') {
          this.logger.debug(
            `Python stdin error for token ${gameToken}: ${error.message}`,
          );
        }
        // Удаляем процесс из Map, если он еще там
        if (this.activeProcesses.has(gameToken)) {
          this.activeProcesses.delete(gameToken);
        }
      });
    }

    pythonProcess.on('close', (code) => {
      // Удаляем из Map только если процесс еще там (может быть уже удален в stopStreamProcessing)
      if (this.activeProcesses.has(gameToken)) {
      this.activeProcesses.delete(gameToken);
        this.logger.log(
          `Stream processing stopped for token ${gameToken} (process closed with code ${code})`,
        );
      }
    });

    this.activeProcesses.set(gameToken, pythonProcess);
  }

  /**
   * Отправка кадра в процесс обработки (бинарные данные)
   */
  sendFrame(gameToken: string, frameData: Buffer): void {
    const pythonProcess = this.activeProcesses.get(gameToken);
    if (!pythonProcess) {
      // Процесс не существует - это нормально, если он был остановлен
      return;
    }

    // Проверяем, что процесс еще жив и stdin доступен
    if (!pythonProcess.stdin || pythonProcess.killed) {
      // Процесс уже закрыт - удаляем из Map и выходим
      this.activeProcesses.delete(gameToken);
      return;
    }

    try {
    // Отправка бинарных данных: длина (4 байта) + данные
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(frameData.length, 0);

      // Отправка длины и данных с обработкой ошибок
      const writeLength = pythonProcess.stdin.write(lengthBuffer);
      if (!writeLength) {
        // Буфер переполнен, но это не критично
        pythonProcess.stdin.once('drain', () => {
    pythonProcess.stdin?.write(frameData);
        });
      } else {
        pythonProcess.stdin.write(frameData);
      }
    } catch (error) {
      // Ошибка записи (например, EOF) - процесс закрыт
      this.logger.debug(
        `Failed to write frame to process ${gameToken}: ${error.message}`,
      );
      this.activeProcesses.delete(gameToken);
    }
  }

  /**
   * Остановка обработки потока
   */
  stopStreamProcessing(gameToken: string): void {
    const pythonProcess = this.activeProcesses.get(gameToken);
    if (pythonProcess) {
      // Удаляем из Map ДО kill, чтобы on('close') не логировал повторно
      this.activeProcesses.delete(gameToken);
      pythonProcess.kill();
      this.logger.log(`Stream processing stopped for token ${gameToken}`);
    }
  }

  /**
   * Проверка, есть ли активный процесс обработки для токена
   */
  hasActiveProcess(gameToken: string): boolean {
    return this.activeProcesses.has(gameToken);
  }

  /**
   * Проверка наличия маппинга для токена
   */
  hasMapping(gameToken: string): boolean {
    const mappingPath = join(this.mappingsDir, `${gameToken}_mapping.json`);
    return existsSync(mappingPath);
  }

  /**
   * Получение сохранённого маппинга для токена
   */
  getMapping(gameToken: string): any | null {
    try {
      const mappingPath = join(this.mappingsDir, `${gameToken}_mapping.json`);
      if (!existsSync(mappingPath)) {
        return null;
      }
      const raw = readFileSync(mappingPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      this.logger.error(
        `Error reading mapping for token ${gameToken}`,
        error as Error,
      );
      return null;
    }
  }

  /**
   * Удаление маппинга для токена (для тестирования - калибровка будет запускаться заново)
   */
  async deleteMapping(gameToken: string): Promise<void> {
    try {
      const mappingPath = join(this.mappingsDir, `${gameToken}_mapping.json`);
      if (existsSync(mappingPath)) {
        await unlink(mappingPath);
        this.logger.log(`Mapping deleted for token ${gameToken}`);
      }
    } catch (error) {
      this.logger.error(
        `Error deleting mapping for token ${gameToken}`,
        error as Error,
      );
    }
  }

  /**
   * Ручная установка ориентации доски по клику на a1
   */
  async setA1Orientation(
    gameToken: string,
    a1X: number,
    a1Y: number,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      // Проверяем наличие маппинга
      if (!this.hasMapping(gameToken)) {
        return {
          success: false,
          message: 'Mapping not found. Please calibrate the board first.',
        };
      }

      // Путь к Python-скрипту
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
        'set_a1_orientation.py',
      );

      const pythonProcess = spawn('python', [
        pythonScript,
        '--token',
        gameToken,
        '--x',
        a1X.toString(),
        '--y',
        a1Y.toString(),
        '--mappings-dir',
        this.mappingsDir,
      ]);

      return new Promise((resolve) => {
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
              // Парсим JSON из stdout
              const lines = stdout.trim().split('\n');
              const jsonLine = lines.find((line) =>
                line.trim().startsWith('{'),
              );
              if (jsonLine) {
                const result = JSON.parse(jsonLine);
                resolve({
                  success: true,
                  message: result.message || 'Orientation set successfully',
                });
              } else {
                resolve({
                  success: true,
                  message: 'Orientation set successfully',
                });
              }
            } catch (error) {
              this.logger.error('Error parsing setA1Orientation result', error);
              resolve({
                success: true,
                message: 'Orientation set (unable to parse response)',
              });
            }
          } else {
            this.logger.error(`setA1Orientation failed: ${stderr}`);
            resolve({
              success: false,
              message: `Failed to set orientation: ${stderr}`,
            });
          }
        });
      });
    } catch (error) {
      this.logger.error('Error in setA1Orientation', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }
}
