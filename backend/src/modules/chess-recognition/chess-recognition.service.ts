import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { join, resolve } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';

export interface FrameDetectionsInfo {
  total_detections?: number;
  classes_detected?: Record<string, number>;
  message?: string;
  hand_detected?: boolean;
  hand_landmarks_inside?: number;
}

/** Ответ Python worker на кадр (frame-processed). */
export interface FrameProcessedResult {
  detections_info?: FrameDetectionsInfo;
  move?: string;
  move_san?: string;
  fen?: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

interface StreamSession {
  onFrameProcessed: (result: FrameProcessedResult) => void;
  onError: (error: Error) => void;
}

interface WorkerMessage {
  event?: string;
  token?: string;
  status?: string;
  message?: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

@Injectable()
export class ChessRecognitionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChessRecognitionService.name);
  private readonly mappingsDir = join(process.cwd(), 'chessboard_mappings');

  private worker: ChildProcess | null = null;
  private workerReady = false;
  private workerReadyResolve: (() => void) | null = null;
  private workerReadyPromise: Promise<void> | null = null;
  private stdoutBuffer = '';
  private stderrBuffer = '';

  private readonly sessions = new Map<string, StreamSession>();
  private readonly pendingCalibrations = new Map<
    string,
    (msg: WorkerMessage) => void
  >();

  constructor() {
    void this.ensureMappingsDir();
  }

  async onModuleInit(): Promise<void> {
    this.startWorker();
    try {
      await this.ensureWorkerReady();
    } catch (error) {
      this.logger.error('CV inference worker failed to start', error);
    }
  }

  onModuleDestroy(): void {
    this.stopWorker();
  }

  private async ensureMappingsDir(): Promise<void> {
    if (!existsSync(this.mappingsDir)) {
      await mkdir(this.mappingsDir, { recursive: true });
    }
  }

  private getProjectRoot(): string {
    const cwd = process.cwd();
    if (
      cwd.endsWith('backend') ||
      cwd.endsWith('backend\\') ||
      cwd.endsWith('backend/')
    ) {
      return join(cwd, '..');
    }
    return cwd;
  }

  private getChessRecognitionRoot(): string {
    return (
      process.env.CHESS_RECOGNITION_DIR ||
      join(this.getProjectRoot(), 'chess-recognition')
    );
  }

  private getModelPaths(): { yolo: string; corner: string } {
    const chessRoot = this.getChessRecognitionRoot();
    return {
      yolo:
        process.env.YOLO_MODEL_PATH ||
        join(chessRoot, 'models', 'bestmerged_new.pt'),
      corner:
        process.env.CORNER_MODEL_PATH ||
        join(chessRoot, 'models', 'best_resnet34_board_corners.pt'),
    };
  }

  private startWorker(): void {
    if (this.worker) {
      return;
    }

    const { yolo, corner } = this.getModelPaths();
    const script = join(this.getChessRecognitionRoot(), 'src', 'inference_worker.py');

    this.workerReady = false;
    this.workerReadyPromise = new Promise<void>((resolve) => {
      this.workerReadyResolve = resolve;
    });

    const pythonBin = this.getPythonBin();
    this.logger.log(
      `Starting CV inference worker (python=${pythonBin}, yolo=${yolo})`,
    );

    this.worker = spawn(pythonBin, [
        script,
        '--mappings-dir',
        this.mappingsDir,
        '--yolo-model',
        yolo,
        '--corner-model',
        corner,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    this.worker.stdout?.on('data', (data: Buffer) => {
      this.handleWorkerStdout(data.toString());
    });

    this.worker.stderr?.on('data', (data: Buffer) => {
      this.handleWorkerStderr(data.toString());
    });

    this.worker.on('error', (error) => {
      this.logger.error(`CV worker process error: ${error.message}`);
    });

    this.worker.on('close', (code) => {
      this.logger.warn(`CV worker exited with code ${code ?? 'unknown'}`);
      this.worker = null;
      this.workerReady = false;
      this.workerReadyResolve = null;
      this.workerReadyPromise = null;
    });

    if (this.worker.stdin) {
      this.worker.stdin.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EOF') {
          this.logger.debug(`CV worker stdin error: ${error.message}`);
        }
      });
    }
  }

  private stopWorker(): void {
    if (!this.worker) {
      return;
    }
    try {
      this.sendCommand({ cmd: 'shutdown' });
    } catch {
      // worker may already be dead
    }
    this.worker.kill();
    this.worker = null;
    this.workerReady = false;
    this.sessions.clear();
    this.pendingCalibrations.clear();
  }

  private async ensureWorkerReady(): Promise<void> {
    if (!this.worker) {
      this.startWorker();
    }
    if (this.workerReady) {
      return;
    }
    if (!this.workerReadyPromise) {
      throw new Error('CV worker is not starting');
    }
    const timeoutMs = 120_000;
    await Promise.race([
      this.workerReadyPromise,
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error('CV worker ready timeout')),
          timeoutMs,
        ),
      ),
    ]);
  }

  private sendCommand(cmd: Record<string, unknown>, binary?: Buffer): void {
    if (!this.worker?.stdin || this.worker.killed) {
      throw new Error('CV worker is not running');
    }
    const line = `${JSON.stringify(cmd)}\n`;
    this.worker.stdin.write(line);
    if (binary) {
      this.worker.stdin.write(binary);
    }
  }

  private handleWorkerStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const msg = JSON.parse(line) as WorkerMessage;
        this.dispatchWorkerMessage(msg);
      } catch {
        this.logger.warn(`Failed to parse worker message: ${line}`);
      }
    }
  }

  private dispatchWorkerMessage(msg: WorkerMessage): void {
    const event = msg.event;

    if (event === 'ready') {
      this.workerReady = true;
      this.workerReadyResolve?.();
      this.logger.log('CV inference worker is ready');
      return;
    }

    if (event === 'calibrate_result' && msg.token) {
      const handler = this.pendingCalibrations.get(msg.token);
      if (handler) {
        this.pendingCalibrations.delete(msg.token);
        handler(msg);
      }
      return;
    }

    if (event === 'frame_result' && msg.token) {
      const session = this.sessions.get(msg.token);
      if (!session) {
        return;
      }
      if (msg.status === 'error' && msg.message) {
        session.onError(new Error(String(msg.message)));
        return;
      }
      const { event: _e, token: _t, ...framePayload } = msg;
      session.onFrameProcessed(framePayload as FrameProcessedResult);
      return;
    }

    if (event === 'error') {
      this.logger.error(`CV worker error: ${msg.message ?? 'unknown'}`);
    }
  }

  private handleWorkerStderr(chunk: string): void {
    this.stderrBuffer += chunk;
    const lines = this.stderrBuffer.split('\n');
    this.stderrBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      if (
        line.includes('[WORKER]') ||
        line.includes('[RESNET]') ||
        line.includes('[MAPPING]') ||
        line.includes('[MOVE]')
      ) {
        this.logger.log(`🐍 [CV] ${line.trim()}`);
      } else if (
        line.includes('Error') ||
        line.includes('Traceback') ||
        line.includes('Exception')
      ) {
        this.logger.error(`🐍 [CV] ${line.trim()}`);
      } else {
        this.logger.debug(`🐍 [CV] ${line.trim()}`);
      }
    }
  }

  async calibrateBoard(
    gameToken: string,
    imageBuffer: Buffer,
  ): Promise<{ success: boolean; message: string; mappingData?: unknown }> {
    try {
      const tempImagePath = join(
        this.mappingsDir,
        `${gameToken}_calibration.jpg`,
      );
      await writeFile(tempImagePath, imageBuffer);
      await this.ensureWorkerReady();

      const result = await new Promise<WorkerMessage>((resolve) => {
        this.pendingCalibrations.set(gameToken, resolve);
        this.sendCommand({
          cmd: 'calibrate_auto',
          token: gameToken,
          image_path: tempImagePath,
        });
      });

      if (result.success) {
        const mappingData = this.getMapping(gameToken);
        return {
          success: true,
          message: 'Board calibrated successfully',
          mappingData,
        };
      }
      return {
        success: false,
        message: String(result.error ?? 'Calibration failed'),
      };
    } catch (error) {
      this.logger.error('Error in calibrateBoard', error);
      return {
        success: false,
        message: `Error: ${(error as Error).message}`,
      };
    }
  }

  startStreamProcessing(
    gameToken: string,
    _modelPath: string,
    onFrameProcessed: (result: FrameProcessedResult) => void,
    onError: (error: Error) => void,
  ): void {
    if (this.sessions.has(gameToken)) {
      this.logger.warn(
        `Stream processing already active for token ${gameToken}`,
      );
      return;
    }

    this.sessions.set(gameToken, { onFrameProcessed, onError });

    void this.ensureWorkerReady()
      .then(() => {
        this.sendCommand({ cmd: 'register', token: gameToken });
        this.logger.log(
          `Stream session registered in CV worker for token ${gameToken}`,
        );
      })
      .catch((error) => {
        this.sessions.delete(gameToken);
        onError(error as Error);
      });
  }

  private readonly sendFrameSkipLogAt = new Map<string, number>();

  sendFrame(gameToken: string, frameData: Buffer): void {
    const session = this.sessions.get(gameToken);
    if (!session || !this.worker?.stdin || this.worker.killed) {
      const now = Date.now();
      const last = this.sendFrameSkipLogAt.get(gameToken) ?? 0;
      if (now - last > 5000) {
        this.sendFrameSkipLogAt.set(gameToken, now);
        this.logger.warn(
          `Frame dropped for ${gameToken}: CV session not active (mapping ok=${this.hasMapping(gameToken)}, worker=${!!this.worker && !this.worker.killed})`,
        );
      }
      return;
    }

    try {
      this.sendCommand(
        { cmd: 'frame', token: gameToken, length: frameData.length },
        frameData,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send frame for token ${gameToken}: ${(error as Error).message}`,
      );
      this.sessions.delete(gameToken);
    }
  }

  stopStreamProcessing(gameToken: string): void {
    this.sessions.delete(gameToken);
    if (!this.worker?.stdin || this.worker.killed) {
      return;
    }
    try {
      this.sendCommand({ cmd: 'unregister', token: gameToken });
      this.logger.log(`Stream session stopped for token ${gameToken}`);
    } catch {
      // worker already closed
    }
  }

  hasActiveProcess(gameToken: string): boolean {
    return this.sessions.has(gameToken);
  }

  hasMapping(gameToken: string): boolean {
    const mappingPath = join(this.mappingsDir, `${gameToken}_mapping.json`);
    return existsSync(mappingPath);
  }

  getMapping(gameToken: string): unknown | null {
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

  private getPythonBin(): string {
    const venvPython =
      process.platform === 'win32'
        ? resolve(this.getChessRecognitionRoot(), '.venv', 'Scripts', 'python.exe')
        : resolve(this.getChessRecognitionRoot(), '.venv', 'bin', 'python3');
    if (existsSync(venvPython)) {
      return venvPython;
    }
    if (process.env.PYTHON_BIN?.trim()) {
      return process.env.PYTHON_BIN.trim();
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }
}
