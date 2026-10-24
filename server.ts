import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import { GoogleGenAI, Modality } from '@google/genai';
import * as types from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile } from 'fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { registerAccounts, verifyToken } from './src/accounts.js';
import { serveStatic } from '@hono/node-server/serve-static';

dotenv.config();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export function createBlob(audioData: string): types.Blob {
  return {data: audioData, mimeType: 'audio/pcm;rate=16000'};
}

export function debug(data: object): string {
  return JSON.stringify(data);
}

function createApplicationServer() {
  const lastCodePayloadBySocket = new WeakMap<WebSocket, string>();
  const latestCodeSnapshotBySocket = new WeakMap<WebSocket, {
    language: string;
    topic: string;
    code: string;
  }>();

  const model = 'gemini-2.5-flash-native-audio-latest';
  const interviewSystemPrompt = [
    'You are a strict interviewer. Your tone is cold, skeptical, and high-pressure.',
    'Begin with a brief professional welcome, then ask 1-2 warm-up questions before moving to strict mode.',
    'In strict mode, do not be kind, warm, motivational, or reassuring. No praise.',
    'Challenge weak answers directly and push for specifics.',
    'Ask exactly one question at a time, then stop and wait for candidate response.',
    'Never ask a second question until the candidate has answered the first.',
    'If the candidate is silent or unclear, ask a single short clarification and wait again.',
    'If candidate says hello/greetings, respond with a short welcome and one basic question first.',
    'If the candidate asks for interview suggestions, give exactly three: Software Engineer, Product Manager, Data Analyst.',
    'Only in the main interview page coding rounds, include token [[OPEN_EDITOR]] when coding starts, and [[CLOSE_EDITOR]] when coding ends.',
    'If explicitly told to use coding-only mode, never output [[OPEN_EDITOR]] or [[CLOSE_EDITOR]].',
    'Keep each response concise and realistic for actual company interviews.',
  ].join(' ');

  const config: types.LiveConnectConfig = {
    responseModalities: [
      Modality.AUDIO,
    ],
    outputAudioTranscription: {},
    inputAudioTranscription: {},
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Aoede',
        },
      },
    },
    systemInstruction: interviewSystemPrompt,
  };

  // Each connection owns its AI session; user content is never broadcast.
  function createLiveSession(socket: WebSocket) {
  let sessionPromise: ReturnType<typeof connectGemini> | null = null;

  function connectGemini() {
    if (!GOOGLE_API_KEY) {
      return Promise.reject(new Error('GOOGLE_API_KEY is not configured'));
    }

    const ai = new GoogleGenAI({
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    });

    console.log('🔌 Connecting to Gemini Live API with model:', model);
    return ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {
          console.log('✅ Live Session Opened Successfully');
        },
        onmessage: (message: types.LiveServerMessage) => {
          // Do not log candidate audio, code, or transcript content.
          const input = message.serverContent?.inputTranscription?.text;
          if (input && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'userTranscript', data: input }));

          const transcription = message.serverContent?.outputTranscription?.text;
          if (transcription) {
            [socket].forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({type: 'textStream', data: transcription}));
              }
            });
          }

          const parts = message.serverContent?.modelTurn?.parts || [];
          parts.forEach((part) => {
            if (part.inlineData?.data) {
              [socket].forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'audioStream',
                    data: part.inlineData?.data,
                    mimeType: part.inlineData?.mimeType,
                  }));
                }
              });
            }
          });
        },
        onerror: (e: ErrorEvent) => {
          console.error('❌ Live Session Error:', e);
        },
        onclose: (e: CloseEvent) => {
          console.log('⚠️ Live Session Closed', e.code, e.reason);
          sessionPromise = null;
        },
      },
    });
  }

  function getGeminiSession() {
    if (!sessionPromise) {
      sessionPromise = connectGemini().catch((error) => {
        sessionPromise = null;
        throw error;
      });
    }
    return sessionPromise;
  }
  return { getGeminiSession, close: () => { void sessionPromise?.then(s => s.close()).catch(() => {}); } };
  }

  const app = new Hono();

  registerAccounts(app);
  app.use('/assets/*', serveStatic({ root: './public', rewriteRequestPath: p => p.replace('/assets/', '/') }));
  for (const route of ['/login', '/signup', '/history']) {
    app.get(route, async (c) => c.html(await readFile(join(process.cwd(), 'public', 'account.html'), 'utf-8')));
  }

  app.get('/', async (c) => {
    return c.html(await readFile(join(process.cwd(), 'public', 'home.html'), 'utf-8'));
  });

  app.get('/interview', async (c) => {
    const html = await readFile(join(process.cwd(), 'public', 'index.html'), 'utf-8');
    return c.html(html);
  });

  app.get('/coding', async (c) => {
    const html = await readFile(join(process.cwd(), 'public', 'coding.html'), 'utf-8');
    return c.html(html);
  });

  // Create an explicit HTTP/1 server. `serve()` returns a ServerType union that
  // also includes HTTP/2 servers, but `ws` can only attach to HTTP/1/HTTPS.
  const server = createServer(getRequestListener(app.fetch));

  const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 });

  wss.on('connection', (socket) => {
    console.log('WebSocket client connected');
    const live = createLiveSession(socket);
    let authenticated = false;
    const authTimeout = setTimeout(() => { if (!authenticated) socket.close(1008, 'Sign in required'); }, 15000);

    socket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'authenticate') {
          await verifyToken(String(message.token || ''));
          authenticated = true;
          clearTimeout(authTimeout);
          socket.send(JSON.stringify({ type: 'authenticated' }));
          return;
        }
        if (!authenticated) throw new Error('Sign in before starting an interview');

        if (message.type === 'codeSnapshot') {
          const language = String(message.language || '').trim();
          const topic = String(message.topic || '').trim();
          const code = String(message.code || '').trim();
          if (language && topic && code) {
            latestCodeSnapshotBySocket.set(socket, { language, topic, code });
          }
          return;
        }

        const session = await live.getGeminiSession();

        if (message.type === 'startInterview') {
          const interviewTarget = String(message.interviewTarget || '').trim();
          if (!interviewTarget) {
            return;
          }
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{
                  text: `Interview target: ${interviewTarget}. Start with a short welcome and one basic warm-up question. After warm-up, transition to strict interview mode.`,
                }],
              },
            ],
            turnComplete: true,
          });
        } else if (message.type === 'startCodingInterview') {
          const language = String(message.language || '').trim();
          const topic = String(message.topic || '').trim();
          if (!language || !topic) {
            return;
          }
          latestCodeSnapshotBySocket.set(socket, { language, topic, code: '' });

          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{
                  text: [
                    'Switch to coding-only interview mode now.',
                    `Language: ${language}.`,
                    `Topic: ${topic}.`,
                    'Immediately present one coding problem with constraints and sample I/O.',
                    'Use plain text only. No markdown tables, no backticks, no LaTeX formatting, no math symbols like $ or \\text{}.',
                    'Do not include [[OPEN_EDITOR]] or [[CLOSE_EDITOR]] in this coding-only mode.',
                    'Speak naturally as an interviewer and wait for the candidate code before the next follow-up.',
                    'Then wait for code and review it in concise rounds.',
                  ].join(' '),
                }],
              },
            ],
            turnComplete: true,
          });
        } else if (message.type === 'codingVoiceDoubtStart') {
          const language = String(message.language || '').trim();
          const topic = String(message.topic || '').trim();
          const snapshot = latestCodeSnapshotBySocket.get(socket);
          const context = snapshot?.code?.trim() || '';
          const contextLanguage = language || snapshot?.language || '';
          const contextTopic = topic || snapshot?.topic || '';
          if (context && contextLanguage && contextTopic) {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{
                    text: [
                      `CURRENT_DRAFT_CONTEXT language=${contextLanguage} topic=${contextTopic}`,
                      context,
                      'Candidate will now ask a voice doubt. Wait for the voice question before answering.',
                    ].join('\n\n'),
                  }],
                },
              ],
              turnComplete: false,
            });
          }
        } else if (message.type === 'contentUpdateText') {
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: message.text }],
              },
            ],
            turnComplete: true,
          });
        } else if (message.type === 'liveCodeUpdate') {
          const requestReview = Boolean(message.requestReview);
          if (!requestReview) {
            return;
          }

          const incomingLanguage = String(message.language || '').trim();
          const incomingTopic = String(message.topic || '').trim();
          const incomingCode = String(message.code || '').trim();
          const codeChanged = Boolean(message.codeChanged);
          const snapshot = latestCodeSnapshotBySocket.get(socket);

          const language = incomingLanguage || snapshot?.language || '';
          const topic = incomingTopic || snapshot?.topic || '';
          const code = incomingCode || snapshot?.code || '';

          if (!language || !topic) {
            return;
          }
          if (!code && codeChanged) {
            return;
          }

          if (incomingCode) {
            latestCodeSnapshotBySocket.set(socket, { language, topic, code: incomingCode });
          }

          if (!incomingCode && !codeChanged) {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{
                    text: [
                      `CODE_REVIEW_FOLLOWUP language=${language} topic=${topic}`,
                      'Candidate asked for follow-up guidance on the same draft.',
                      'Give one concrete improvement, then ask exactly one targeted follow-up question.',
                      'Do not repeat full prior feedback.',
                    ].join('\n'),
                  }],
                },
              ],
              turnComplete: true,
            });
            return;
          }

          const payload = `CODE_REVIEW_UPDATE language=${language} topic=${topic}\n${code}`;
          if (lastCodePayloadBySocket.get(socket) === payload) {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{
                    text: [
                      `CODE_REVIEW_FOLLOWUP language=${language} topic=${topic}`,
                      'Candidate requested another pass on unchanged code.',
                      'Avoid saying only "incomplete". Point to one specific missing block and one improvement.',
                    ].join('\n'),
                  }],
                },
              ],
              turnComplete: true,
            });
            return;
          }

          lastCodePayloadBySocket.set(socket, payload);
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{
                  text: [
                    payload,
                    'Review in this order: correctness, complexity, and edge cases.',
                    'If draft is partial, identify the next exact block to implement instead of generic incomplete remarks.',
                    'End with one concise follow-up question.',
                  ].join('\n\n'),
                }],
              },
            ],
            turnComplete: true,
          });
        } else if (message.type === 'realtimeInput') {
          session.sendRealtimeInput({media: createBlob(message.audioData)});
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        if (socket.readyState === WebSocket.OPEN) {
          const message = error instanceof Error ? error.message : 'Unable to start the interview session';
          socket.send(JSON.stringify({type: 'error', message}));
        }
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      console.log('WebSocket client disconnected');
      live.close();
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      live.close();
    });
  });

  return server;
}

const server = createApplicationServer();

// Vercel invokes the exported server as a Function. Local development owns its
// listener and uses port 8000 unless PORT is explicitly provided.
if (!process.env.VERCEL) {
  const listenTarget = process.env.PORT ?? 8000;
  server.listen(listenTarget, () => {
    console.log(`Server running on ${listenTarget}`);
  });
}

export default server;
