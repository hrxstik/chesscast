# Chess Recognition System

Система распознавания шахматной доски и фигур с использованием YOLO 11 и трекинга.

## Структура проекта

- `src/model/` - Модели и обработчики
  - `yolo11_detector.py` - Детектор YOLO 11 для фигур
  - `stream_processor.py` - Обработчик потока в реальном времени
  - `chessboard_calibration.py` - Калибровка доски (старая версия)
- `src/improved_board_mapping.py` - Улучшенный маппинг доски
- `src/calibrate_board.py` - Скрипт для калибровки через CLI
- `src/stream_server.py` - Сервер для обработки потока

## Установка

```bash
pip install -r requirements.txt
```

## Использование

### Калибровка доски

```bash
python src/calibrate_board.py --token <game_token> --image <path_to_image> --mappings-dir <mappings_directory>
```

### Обработка потока

```bash
python src/stream_server.py --token <game_token> --model <path_to_yolo_model> --mappings-dir <mappings_directory>
```

## API Endpoints (NestJS)

- `POST /api/chess-recognition/:token/calibrate` - Калибровка доски
- `GET /api/chess-recognition/:token/mapping` - Проверка наличия маппинга
- WebSocket: `/chess-stream` - Поток обработки кадров

## WebSocket Events

- `start-stream` - Запуск обработки потока
- `frame` - Отправка кадра (base64)
- `frame-processed` - Результат обработки кадра
- `stop-stream` - Остановка обработки


