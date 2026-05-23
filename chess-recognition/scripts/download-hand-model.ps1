$dest = Join-Path $PSScriptRoot "..\models\hand_landmarker.task"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
if (Test-Path $dest) {
  Write-Host "Already exists: $dest"
  exit 0
}
Invoke-WebRequest `
  -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" `
  -OutFile $dest `
  -UseBasicParsing
Write-Host "Saved: $dest"
