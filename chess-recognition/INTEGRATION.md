# Интеграция системы распознавания шахмат

## Обзор архитектуры

Система состоит из двух частей:
1. **Python сервис** (`chess-recognition/`) - обработка изображений, детекция фигур, трекинг
2. **NestJS API** (`server/src/modules/chess-recognition/`) - REST API и WebSocket для коммуникации

## Сценарий работы

### 1. Создание игры и калибровка

1. Пользователь создает игру на фронтенде → получает `game_token`
2. Пользователь ставит телефон на штатив, доска пуста
3. Фронтенд отправляет кадр с пустой доской на калибровку:
   ```
   POST /api/chess-recognition/:token/calibrate
   Content-Type: multipart/form-data
   Body: { image: File }
   ```
4. Сервер запускает Python скрипт `calibrate_board.py`:
   - Определяет границы доски (работает на не черных столах, с закруглениями)
   - Определяет углы клеток (9x9 матрица)
   - Проверяет, что доска пуста
   - Сохраняет маппинг в `chessboard_mappings/{token}_mapping.json`
5. Если доска не пуста → возвращается ошибка, фронтенд показывает сообщение
6. Если успешно → маппинг сохранен, можно продолжать

### 2. Начальная расстановка и запуск трекинга

1. Пользователь расставляет фигуры в начальную позицию
2. Фронтенд подключается к WebSocket: `ws://server/chess-stream`
3. Отправляет событие `start-stream`:
   ```json
   {
     "token": "game_token",
     "modelPath": "optional/path/to/model.pt"
   }
   ```
4. Сервер запускает Python процесс `stream_server.py` для обработки потока
5. При первом кадре происходит инициализация трекера:
   - Детекция всех фигур на доске
   - Сопоставление с ожидаемой начальной позицией
   - Создание треков для каждой фигуры

### 3. Обработка потока во время игры

1. Фронтенд отправляет кадры через WebSocket событие `frame`:
   ```json
   {
     "token": "game_token",
     "frame": "base64_encoded_image"
   }
   ```
2. Сервер передает кадр в Python процесс через stdin
3. Python процесс:
   - Применяет маппинг (выравнивает доску)
   - Детектирует фигуры через YOLO 11
   - Обновляет треки фигур (сопоставление по IoU и классу)
   - Определяет состояние доски (8x8 матрица)
   - Определяет ход (сравнение с предыдущим состоянием)
4. Результат отправляется обратно через WebSocket событие `frame-processed`:
   ```json
   {
     "status": "processed",
     "tracks": {
       "0": {"bbox": [x1, y1, x2, y2], "class": "white-pawn", "confidence": 0.95},
       ...
     },
     "board_state": [[-1, -1, ...], ...],
     "move": "e2e4",  // если ход обнаружен
     "move_san": "e4"
   }
   ```

### 4. Остановка обработки

Фронтенд отправляет событие `stop-stream` для остановки процесса.

## Важные моменты

### Трекинг работает только для обычной игры

- Трекинг инициализируется на основе стандартной начальной позиции
- Фигуры отслеживаются по их позициям в начальной расстановке
- При повышении пешки трек обновляется (новая фигура получает тот же track_id)

### Маппинг сохраняется по токену игры

- Каждая игра имеет свой маппинг
- Маппинг включает:
  - Координаты углов доски (4 точки)
  - Координаты углов всех клеток (9x9 матрица)
  - Матрицу перспективного преобразования
  - Информацию о пустоте доски

### Обработка потока в реальном времени

- Python процесс работает как отдельный процесс
- Коммуникация через stdin/stdout (JSON строки)
- Каждый кадр обрабатывается независимо
- Трекинг поддерживает временную потерю фигур (использует последнюю известную позицию)

## API Reference

### REST Endpoints

#### POST `/api/chess-recognition/:token/calibrate`
Калибровка доски

**Request:**
- `token` (path parameter) - токен игры
- `image` (multipart/form-data) - изображение доски

**Response:**
```json
{
  "success": true,
  "message": "Board calibrated successfully",
  "mappingData": { ... }
}
```

#### GET `/api/chess-recognition/:token/mapping`
Проверка наличия маппинга

**Response:**
```json
{
  "hasMapping": true
}
```

### WebSocket Events

#### Namespace: `/chess-stream`

**Client → Server:**

1. `start-stream`
   ```json
   {
     "token": "game_token",
     "modelPath": "optional/path/to/model.pt"
   }
   ```

2. `frame`
   ```json
   {
     "token": "game_token",
     "frame": "base64_encoded_image"
   }
   ```

3. `stop-stream`
   ```json
   {
     "token": "game_token"
   }
   ```

**Server → Client:**

1. `stream-started`
   ```json
   {
     "token": "game_token"
   }
   ```

2. `frame-processed`
   ```json
   {
     "status": "processed",
     "tracks": { ... },
     "board_state": [ ... ],
     "move": "e2e4",
     "move_san": "e4"
   }
   ```

3. `error`
   ```json
   {
     "message": "Error description"
   }
   ```

## Требования

- Python 3.8+
- Node.js 18+
- YOLO 11 модель (обученная на шахматных фигурах)
- OpenCV, NumPy, SciPy, ultralytics

## Переменные окружения

```env
YOLO_MODEL_PATH=./chess-recognition/assets/models/chess_pieces_yolo11_n_best.pt
```


