import { useState, useRef, useEffect, useCallback } from "react";
import { Icon, go } from "./kit";
import { useStore, waLink } from "../lib/store";
import { getAuthAccessToken } from "../lib/supabase";

type LiveStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "streaming_text"
  | "error";

interface LiveAction {
  label: string;
  url: string;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export function ResolveAI({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [store] = useStore();
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [userTranscript, setUserTranscript] = useState("");
  const [aiTranscript, setAiTranscript] = useState(
    "Toque em «Iniciar em Tempo Real» para falar ao vivo com o Resolve AI."
  );
  const [liveAction, setLiveAction] = useState<LiveAction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quickCommand, setQuickCommand] = useState("");

  // Mutable refs for audio callbacks / WebSocket handlers (prevent stale closures)
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const isLiveReadyRef = useRef<boolean>(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  isMutedRef.current = isMuted;

  const stopQueuedPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // already ended
      }
      try {
        src.disconnect();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const teardownLiveSession = useCallback(() => {
    isLiveReadyRef.current = false;
    setMicLevel(0);

    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "close" }));
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.onaudioprocess = null;
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    stopQueuedPlayback();

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    setStatus("idle");
  }, [stopQueuedPlayback]);

  useEffect(() => {
    if (!isOpen) {
      teardownLiveSession();
    }
    return () => {
      teardownLiveSession();
    };
  }, [isOpen, teardownLiveSession]);

  const schedulePcmPlayback = useCallback((base64Audio: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;
    if (outCtx.state === "suspended") {
      outCtx.resume().catch(() => {});
    }

    const float32 = base64Pcm16ToFloat32(base64Audio);
    if (float32.length === 0) return;

    const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(new Float32Array(float32), 0);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const startAt = Math.max(nextStartTimeRef.current, outCtx.currentTime);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    setStatus("speaking");

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0 && isLiveReadyRef.current) {
        setStatus("listening");
      }
    };
  }, []);

  const startLiveVoiceSession = async () => {
    if (status === "connecting" || status === "listening" || status === "speaking") {
      return;
    }

    teardownLiveSession();
    setErrorMsg(null);
    setLiveAction(null);
    setUserTranscript("");
    setAiTranscript("A ligar à sessão de voz em tempo real...");
    setStatus("connecting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "O navegador não suporta captura de microfone neste dispositivo."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      if (inputCtx.state === "suspended") await inputCtx.resume();
      if (outputCtx.state === "suspended") await outputCtx.resume();
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const token = await getAuthAccessToken();
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/ai-live`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "init",
            token,
            location: store.location,
            bookings: store.bookings.slice(0, 5).map((b) => ({
              id: b.id,
              service: b.service,
              status: b.status,
              date: b.date,
              slot: b.slot,
            })),
          })
        );
      };

      ws.onmessage = (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "ready") {
          isLiveReadyRef.current = true;
          setStatus("listening");
          setAiTranscript("Em direto — pode falar agora com o Resolve AI.");

          // Begin capturing 16kHz PCM microphone stream
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          sourceNodeRef.current = source;
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(inputCtx.destination);

          processor.onaudioprocess = (e) => {
            if (!isLiveReadyRef.current || isMutedRef.current) {
              setMicLevel(0);
              return;
            }
            const channel = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < channel.length; i++) {
              sum += channel[i] * channel[i];
            }
            const rms = Math.sqrt(sum / channel.length);
            setMicLevel(Math.min(1, rms * 5));

            if (wsRef.current?.readyState === WebSocket.OPEN) {
              const base64Pcm = float32ToPcm16Base64(channel);
              wsRef.current.send(
                JSON.stringify({ type: "audio", data: base64Pcm })
              );
            }
          };
          return;
        }

        if (msg.type === "audio" && typeof msg.data === "string") {
          schedulePcmPlayback(msg.data);
          return;
        }

        if (msg.type === "input_transcript" && typeof msg.text === "string") {
          setUserTranscript((prev) => `${prev}${msg.text}`.slice(-280));
          return;
        }

        if (msg.type === "output_transcript" && typeof msg.text === "string") {
          setAiTranscript((prev) => {
            const isDefaultHint =
              prev === "Em direto — pode falar agora com o Resolve AI." ||
              prev === "A ligar à sessão de voz em tempo real...";
            return `${isDefaultHint ? "" : prev}${msg.text}`.slice(-500);
          });
          return;
        }

        if (msg.type === "interrupted") {
          stopQueuedPlayback();
          setStatus("listening");
          return;
        }

        if (msg.type === "turn_complete") {
          // Next user utterance starts fresh live subtitle context
          setUserTranscript("");
          return;
        }

        if (msg.type === "action" && msg.action?.url && msg.action?.label) {
          setLiveAction({ label: msg.action.label, url: msg.action.url });
          return;
        }

        if (msg.type === "error") {
          setErrorMsg(msg.message || "Falha na ligação em tempo real.");
          teardownLiveSession();
          setStatus("error");
          return;
        }

        if (msg.type === "closed") {
          teardownLiveSession();
        }
      };

      ws.onerror = () => {
        setErrorMsg("Não foi possível estabelecer a ligação WebSocket em tempo real.");
        teardownLiveSession();
        setStatus("error");
      };

      ws.onclose = () => {
        if (isLiveReadyRef.current) {
          teardownLiveSession();
        }
      };
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Permissão de microfone recusada. Autorize o microfone ou envie um comando direto em tempo real abaixo."
          : err?.message || "Erro ao iniciar o microfone em tempo real.";
      teardownLiveSession();
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  // Send a live cue either into the active Live Voice session OR via real-time SSE token streaming
  const sendRealtimeCue = async (cueText?: string) => {
    const clean = (cueText ?? quickCommand).trim();
    if (!clean) return;
    if (!cueText) setQuickCommand("");
    setErrorMsg(null);
    setUserTranscript(clean);

    // 1. If Gemini Live WebSocket is active, inject directly into the live audio session
    if (isLiveReadyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      stopQueuedPlayback();
      setAiTranscript("");
      wsRef.current.send(JSON.stringify({ type: "text", text: clean }));
      return;
    }

    // 2. Otherwise stream tokens in real time via SSE (/api/ai/stream)
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setStatus("streaming_text");
    setAiTranscript("");
    setLiveAction(null);

    try {
      const token = await getAuthAccessToken();
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: clean,
          context: {
            location: store.location,
            bookings: store.bookings.slice(0, 5).map((b) => ({
              id: b.id,
              service: b.service,
              status: b.status,
              date: b.date,
              slot: b.slot,
            })),
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errPayload = await res.json().catch(() => null);
        throw new Error(
          errPayload?.error || "Falha ao ligar ao stream da IA em tempo real."
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.replace(/^data:\s*/, "").trim();
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine);
            if (payload.chunk) {
              setAiTranscript((prev) => `${prev}${payload.chunk}`);
            } else if (payload.error) {
              setErrorMsg(payload.error);
            }
          } catch {
            // ignore partial SSE JSON
          }
        }
      }
      setStatus("idle");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setErrorMsg(
        err?.message || "Não foi possível obter resposta da IA em tempo real."
      );
      setStatus("error");
    }
  };

  const quickCues = [
    "Quero pedir limpeza ao domicílio",
    "Entregar botija de gás hoje",
    "Como funcionam os planos?",
    "Preciso de explicações escolares",
  ];

  if (!isOpen) return null;

  const isLiveActive = status === "listening" || status === "speaking";
  const statusLabel =
    status === "connecting"
      ? "A LIGAR AO VIVO..."
      : status === "speaking"
      ? "IA A FALAR EM DIRETO"
      : status === "listening"
      ? isMuted
        ? "MICROFONE SILENCIADO"
        : "EM DIRETO • A OUVIR"
      : status === "streaming_text"
      ? "STREAM EM TEMPO REAL"
      : status === "error"
      ? "LIGAÇÃO INTERROMPIDA"
      : "PRONTO PARA TEMPO REAL";

  const orbScale =
    status === "speaking"
      ? 1.12
      : status === "listening"
      ? 1 + micLevel * 0.25
      : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-[calc(var(--radius)*1.5)] border border-border bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-ink px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-action text-action-ink">
              <Icon name="AudioLines" className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black tracking-tight text-white">
                  RESOLVE AI
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isLiveActive
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40"
                      : "bg-action/20 text-action"
                  }`}
                >
                  {isLiveActive && (
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  )}
                  TEMPO REAL
                </span>
              </div>
              <p className="text-[11px] font-semibold text-white/75 tracking-wide">
                {statusLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              teardownLiveSession();
              onClose();
            }}
            className="grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Fechar"
          >
            <Icon name="X" className="size-5" />
          </button>
        </div>

        {/* Live Voice Stage (Real-Time Studio, Not a Chatbot) */}
        <div className="flex flex-col items-center justify-between gap-5 bg-gradient-to-b from-[#071B33] via-[#0B2545] to-[#0F2E54] px-6 py-7 text-white">
          {/* Interactive Voice Orb */}
          <div className="relative flex items-center justify-center py-2">
            <div
              className={`absolute size-36 rounded-full transition-transform duration-150 ${
                status === "speaking"
                  ? "bg-action/25 blur-md"
                  : status === "listening"
                  ? "bg-emerald-400/20 blur-md"
                  : "bg-white/5"
              }`}
              style={{ transform: `scale(${orbScale * 1.15})` }}
            />
            <button
              type="button"
              onClick={() => {
                if (isLiveActive || status === "connecting") {
                  teardownLiveSession();
                } else {
                  void startLiveVoiceSession();
                }
              }}
              className={`relative z-10 grid size-24 place-items-center rounded-full border-2 transition-all duration-200 shadow-xl cursor-pointer ${
                status === "speaking"
                  ? "border-action bg-action text-action-ink"
                  : status === "listening"
                  ? "border-emerald-400 bg-emerald-500/20 text-white"
                  : status === "connecting"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse"
                  : "border-white/30 bg-white/10 text-white hover:border-action hover:bg-action/20"
              }`}
              style={{ transform: `scale(${orbScale})` }}
              aria-label={
                isLiveActive ? "Terminar conversa em tempo real" : "Iniciar conversa por voz em tempo real"
              }
            >
              <Icon
                name={
                  status === "connecting"
                    ? "Loader2"
                    : status === "speaking"
                    ? "Volume2"
                    : isLiveActive
                    ? isMuted
                      ? "MicOff"
                      : "Mic"
                    : "Mic"
                }
                className={`size-9 ${status === "connecting" ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Real-Time Captions / Live Output */}
          <div className="w-full space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-xs">
            {userTranscript && (
              <p className="text-xs font-medium text-emerald-300 border-b border-white/10 pb-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-white/60 mr-1.5">
                  Você:
                </span>
                {userTranscript}
              </p>
            )}
            <p className="text-sm leading-relaxed text-white/95 min-h-[3.25rem] whitespace-pre-line">
              {aiTranscript || (status === "streaming_text" ? "A transmitir..." : "...")}
            </p>
            {liveAction && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    teardownLiveSession();
                    onClose();
                    go(liveAction.url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-action px-3.5 py-1.5 font-display text-xs font-bold text-action-ink transition hover:brightness-105 cursor-pointer"
                >
                  <span>{liveAction.label}</span>
                  <Icon name="ArrowRight" className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Primary Call Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
            {!isLiveActive && status !== "connecting" ? (
              <button
                type="button"
                onClick={() => void startLiveVoiceSession()}
                className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 font-display text-xs font-black uppercase tracking-wide text-action-ink shadow-lg hover:brightness-105 cursor-pointer"
              >
                <Icon name="Mic" className="size-4" />
                <span>Iniciar em Tempo Real</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold border transition cursor-pointer ${
                    isMuted
                      ? "bg-amber-500/20 border-amber-400 text-amber-200"
                      : "bg-white/10 border-white/25 text-white hover:bg-white/20"
                  }`}
                >
                  <Icon name={isMuted ? "MicOff" : "Mic"} className="size-3.5" />
                  <span>{isMuted ? "Ativar Microfone" : "Silenciar"}</span>
                </button>
                {status === "speaking" && (
                  <button
                    type="button"
                    onClick={() => stopQueuedPlayback()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/25 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 cursor-pointer"
                  >
                    <Icon name="Hand" className="size-3.5" />
                    <span>Interromper</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => teardownLiveSession()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
                >
                  <Icon name="PhoneOff" className="size-3.5" />
                  <span>Terminar</span>
                </button>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="w-full rounded-xl border border-red-400/40 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-100">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Instant Spoken/Text Cues & Direct Command Input */}
        <div className="border-t border-border bg-background/60 px-4 py-3 space-y-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {quickCues.map((cue) => (
              <button
                key={cue}
                type="button"
                onClick={() => void sendRealtimeCue(cue)}
                className="shrink-0 rounded-full border border-border bg-paper px-3 py-1 font-medium text-foreground transition hover:border-primary hover:bg-mist cursor-pointer"
              >
                {cue}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendRealtimeCue();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={quickCommand}
              onChange={(e) => setQuickCommand(e.target.value)}
              placeholder={
                isLiveActive
                  ? "Envie um pedido rápido para a sessão ao vivo..."
                  : "Ou escreva um comando rápido em tempo real..."
              }
              className="flex-1 rounded-[var(--radius)] border border-border bg-mist px-3.5 py-2 text-sm outline-none transition focus:border-primary focus:bg-paper focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!quickCommand.trim() || status === "streaming_text"}
              className="grid size-10 place-items-center rounded-[var(--radius)] bg-action text-action-ink transition hover:brightness-105 disabled:opacity-40 cursor-pointer"
              aria-label="Enviar comando em tempo real"
            >
              <Icon name="Zap" className="size-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Atendimento humano urgente:</span>
            {store.whatsapp && (
              <a
                href={
                  waLink(
                    store.whatsapp,
                    "Olá! Preciso de ajuda de um operador da Resolve Express."
                  ) || undefined
                }
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-whatsapp hover:underline"
              >
                Abrir WhatsApp Oficial
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
