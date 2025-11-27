# Резюме изменений: Переход на YOLO 11 с трекингом

## Созданные файлы

### Python модули

1. **`chess-recognition/src/model/yolo11_detector.py`**
   - `YOLO11Detector` - детектор фигур на основе YOLO 11
   - `PieceTracker` - трекер фигур на основе начальной позиции
   - Поддержка трекинга через сопоставление по IoU и классу

2. **`chess-recognition/src/model/stream_processor.py`**
   - `StreamProcessor` - обработчик потока в реальном времени
   - Инициализация трекера на основе стандартной начальной позиции
   - Определение ходов через сравнение состояний доски
   - Обработка кадров в формате base64

3. **`chess-recognition/src/improved_board_mapping.py`**
   - Экспорт функций маппинга из notebook
   - Улучшенное определение границ доски (работает на не черных столах)
   - Проверка пустой доски
   - Сохранение/загрузка маппинга по токену игры

4. **`chess-recognition/src/calibrate_board.py`**
   - CLI скрипт для калибровки доски
   - Используется NestJS сервисом для запуска калибровки

5. **`chess-recognition/src/stream_server.py`**
   - Сервер для обработки потока кадров
   - Читает base64 кадры из stdin
   - Выводит результаты в JSON формате в stdout

### NestJS модули

1. **`server/src/modules/chess-recognition/chess-recognition.service.ts`**
   - Управление калибровкой доски
   - Запуск/остановка процессов обработки потока
   - Отправка кадров в Python процессы

2. **`server/src/modules/chess-recognition/chess-recognition.controller.ts`**
   - REST API для калибровки
   - Проверка наличия маппинга

3. **`server/src/modules/chess-recognition/chess-recognition.gateway.ts`**
   - WebSocket gateway для потока
   - События: `start-stream`, `frame`, `stop-stream`
   - Отправка результатов: `frame-processed`, `error`

4. **`server/src/modules/chess-recognition/chess-recognition.module.ts`**
   - Модуль NestJS для chess-recognition

### Notebook файлы

1. **`chess-recognition/yolo11_training.ipynb`**
   - Полный процесс обучения YOLO 11
   - Поддержка трекинга (ByteTrack, BoTSORT)
   - Экспорт модели и конфигурации

2. **`chess-recognition/improved_board_mapping.ipynb`**
   - Улучшенный маппинг доски
   - Работа в различных условиях
   - Проверка пустой доски

## Измененные файлы

1. **`server/src/modules/app/app.module.ts`**
   - Добавлен `ChessRecognitionModule`
   - Добавлен `GameModule`

2. **`server/src/main.ts`**
   - Включен CORS для WebSocket

3. **`chess-recognition/requirements.txt`**
   - Добавлен `ultralytics>=8.0.0`

## Удаленный функционал

- Произвольная расстановка фигур (не используется)
- Старый код на Darknet (заменен на YOLO 11)

## Ключевые особенности реализации

### Трекинг фигур

- Работает только для обычной игры (стандартная начальная позиция)
- Инициализация при первом кадре с расставленными фигурами
- Сопоставление детекций с ожидаемыми позициями по классу и расстоянию
- Обновление треков через IoU между кадрами
- Поддержка временной потери фигур (используется последняя известная позиция)

### Маппинг доски

- Адаптивное определение границ (2 метода: контуры + линии)
- Работает на не черных столах
- Поддержка закругленных углов
- Проверка пустоты доски при калибровке
- Сохранение по токену игры

### Обработка потока

- Python процесс обрабатывает кадры из stdin
- Результаты в JSON формате в stdout
- NestJS управляет процессами и коммуникацией
- WebSocket для реального времени

## Следующие шаги

1. Обучить модель YOLO 11 на датасете шахматных фигур
2. Протестировать калибровку на различных досках
3. Протестировать трекинг в реальных условиях
4. Интегрировать с фронтендом (WebSocket клиент)


