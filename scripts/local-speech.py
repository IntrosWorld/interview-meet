"""Loopback-only offline Whisper worker. All model downloads are stored on F:."""
import io
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MODEL_ROOT = Path(os.environ.get('LOCAL_MODEL_DIR', 'F:/AI_models/interview-meet'))
if MODEL_ROOT.drive.upper() != 'F:':
    raise RuntimeError('LOCAL_MODEL_DIR must be on F: for this experiment')
os.environ['HF_HOME'] = str(MODEL_ROOT / 'huggingface')
os.environ['HF_HUB_CACHE'] = str(MODEL_ROOT / 'huggingface' / 'hub')
from faster_whisper import WhisperModel

model_name = os.environ.get('LOCAL_WHISPER_MODEL', 'tiny.en')
local_copy = MODEL_ROOT / 'whisper-tiny.en'
source = str(local_copy) if model_name == 'tiny.en' and (local_copy / 'model.bin').exists() else model_name
print(f'Loading Whisper {model_name} on CPU; model directory: {MODEL_ROOT}', flush=True)
model = WhisperModel(source, device='cpu', compute_type='int8', cpu_threads=6, download_root=str(MODEL_ROOT / 'whisper'))
# Pay encoder/decoder initialization before showing ready, not after the first answer.
import numpy as np
list(model.transcribe(np.zeros(16000, dtype=np.float32), language='en', beam_size=1, vad_filter=False))
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log audio or transcripts.

    def reply(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/health':
            self.reply(200, {'ready': True, 'model': model_name, 'device': 'cpu', 'modelRoot': str(MODEL_ROOT)})
        else:
            self.reply(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/transcribe':
            return self.reply(404, {'error': 'Not found'})
        # Only our Node proxy sends raw audio. Cross-origin browser requests are rejected.
        if self.headers.get('Origin'):
            return self.reply(403, {'error': 'Proxy requests only'})
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size <= 8 * 1024 * 1024:
            return self.reply(413, {'error': 'Record a shorter answer'})
        if not lock.acquire(blocking=False):
            return self.reply(429, {'error': 'Transcription is busy'})
        try:
            start = time.perf_counter()
            segments, info = model.transcribe(io.BytesIO(self.rfile.read(size)), language='en', beam_size=1, vad_filter=True, condition_on_previous_text=False)
            text = ' '.join(s.text.strip() for s in segments).strip()
            self.reply(200, {'text': text, 'transcriptionMs': round((time.perf_counter() - start) * 1000), 'audioSeconds': round(info.duration, 2)})
        except Exception:
            self.reply(422, {'error': 'Unable to decode or transcribe this recording'})
        finally:
            lock.release()


print('Whisper ready: http://127.0.0.1:8766', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
