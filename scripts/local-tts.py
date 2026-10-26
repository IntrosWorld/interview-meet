"""Persistent offline Windows speech renderer with engine-authored viseme timing."""
import atexit, json, queue, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Renderer:
    def __init__(self):
        self.lock=threading.Lock()
        self.process=subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive','-File',str(Path(__file__).with_name('synthesize-timed.ps1')),'-Server'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
        self.responses=queue.Queue()
        def read():
            for line in self.process.stdout: self.responses.put(line)
        threading.Thread(target=read,daemon=True).start()
    def call(self, data):
        with self.lock:
            if self.process.poll() is not None: raise RuntimeError('Speech renderer stopped')
            self.process.stdin.write(json.dumps(data)+'\n'); self.process.stdin.flush()
            try: result=json.loads(self.responses.get(timeout=20))
            except queue.Empty:
                self.process.kill(); raise RuntimeError('Speech renderer timed out')
            if 'error' in result: raise RuntimeError(result['error'])
            return result
    def close(self):
        if self.process.poll() is None: self.process.terminate()

renderer=Renderer(); atexit.register(renderer.close)
voices=renderer.call({'action':'voices'})['voices']
allowed={v['name'] for v in voices}
# Initialize the actual engine before users begin a conversation.
renderer.call({'text':'Ready.'})

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def reply(self,status,data):
        body=json.dumps(data).encode(); self.send_response(status)
        self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path=='/health': self.reply(200,{'ready':True,'voices':voices,'timing':'SAPI VisemeReached / WAV audio positions'})
        else: self.reply(404,{'error':'Not found'})
    def do_POST(self):
        if self.path!='/synthesize': return self.reply(404,{'error':'Not found'})
        if self.headers.get('Origin'): return self.reply(403,{'error':'Proxy requests only'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<8192: return self.reply(413,{'error':'Speech request too large'})
            data=json.loads(self.rfile.read(size))
            if not isinstance(data.get('text'),str) or not 0<len(data['text'])<=600: return self.reply(400,{'error':'Invalid speech text'})
            if data.get('voice') and data['voice'] not in allowed: return self.reply(400,{'error':'Unknown local voice'})
            result=renderer.call({'text':data['text'],'voice':data.get('voice')})
            result['visemes'].sort(key=lambda item:item['time'])
            self.reply(200,result)
        except Exception: self.reply(503,{'error':'Timed local speech is unavailable'})

print('Timed speech ready: http://127.0.0.1:8767',flush=True)
try: ThreadingHTTPServer(('127.0.0.1',8767),Handler).serve_forever()
finally: renderer.close()
