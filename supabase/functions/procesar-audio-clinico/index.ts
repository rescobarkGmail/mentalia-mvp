import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const TRANSCRIPTION_TIMEOUT_MS = 60_000;
const SUMMARY_TIMEOUT_MS = 45_000;

const requestsByUser = new Map<
  string,
  { startedAt: number; count: number }
>();

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAllowedOrigins(): string[] {
  return (Deno.env.get("APP_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();

  return {
    "Access-Control-Allow-Origin":
      allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const current = requestsByUser.get(userId);

  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestsByUser.set(userId, {
      startedAt: now,
      count: 1,
    });
    return;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    throw new HttpError(
      429,
      "Se alcanzó el límite temporal de procesamiento.",
    );
  }

  current.count += 1;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(504, "La solicitud externa excedió el tiempo límite.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: getCorsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      req,
      { error: "Método no permitido." },
      405,
    );
  }

  try {
    if (getAllowedOrigins().length === 0) {
      throw new HttpError(
        500,
        "APP_ALLOWED_ORIGINS no está configurada.",
      );
    }

    const authorization = req.headers.get("Authorization");
    const token = authorization
      ?.replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      throw new HttpError(
        401,
        "Se requiere una sesión autenticada.",
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new HttpError(
        500,
        "La configuración de Supabase está incompleta.",
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(
        401,
        "La sesión es inválida o expiró.",
      );
    }

    const {
      data: profesional,
      error: profesionalError,
    } = await supabase
      .from("profesional")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profesionalError || !profesional) {
      throw new HttpError(
        403,
        "El usuario no tiene un perfil profesional válido.",
      );
    }

    checkRateLimit(user.id);

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiApiKey) {
      throw new HttpError(
        500,
        "OPENAI_API_KEY no está configurada.",
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      throw new HttpError(
        415,
        "La solicitud debe utilizar multipart/form-data.",
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof File)) {
      throw new HttpError(
        400,
        "No se recibió un archivo de audio.",
      );
    }

    if (
      audioFile.size <= 0 ||
      audioFile.size > MAX_AUDIO_BYTES
    ) {
      throw new HttpError(
        413,
        "El audio debe pesar entre 1 byte y 10 MB.",
      );
    }

    if (
      audioFile.type &&
      !audioFile.type.startsWith("audio/")
    ) {
      throw new HttpError(
        415,
        "El archivo debe ser un formato de audio.",
      );
    }

    const transcriptionForm = new FormData();

    transcriptionForm.append(
      "file",
      audioFile,
      "sesion.webm",
    );

    transcriptionForm.append(
      "model",
      "whisper-1",
    );

    transcriptionForm.append(
      "language",
      "es",
    );

    transcriptionForm.append(
      "prompt",
      "Terminología clínica psicológica en español. Palabras frecuentes: ansiedad, depresión, regulación emocional, terapia, emociones, autoestima, estrés y pensamientos automáticos.",
    );

    const transcriptionResponse = await fetchWithTimeout(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: transcriptionForm,
      },
      TRANSCRIPTION_TIMEOUT_MS,
    );

    if (!transcriptionResponse.ok) {
      throw new HttpError(
        502,
        "No se pudo transcribir el audio.",
      );
    }

    const transcriptionData =
      await transcriptionResponse.json();

    const transcripcion = transcriptionData.text || "";

    const prompt = `
Eres un asistente clínico-administrativo para psicólogos.

No diagnostiques, no reemplaces el criterio profesional y no inventes información.

Tu tarea es estructurar una transcripción de sesión psicológica en un borrador editable.

Devuelve únicamente JSON válido con esta estructura:

{
  "resumen_sesion": "",
  "foco_trabajado": "",
  "observaciones": "",
  "tareas_acuerdos": "",
  "proxima_sesion": ""
}

Transcripción:
${transcripcion}
`;

    const summaryResponse = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente clínico-administrativo. Respondes únicamente con JSON válido.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
      SUMMARY_TIMEOUT_MS,
    );

    if (!summaryResponse.ok) {
      throw new HttpError(
        502,
        "No se pudo generar el resumen clínico.",
      );
    }

    const summaryData = await summaryResponse.json();

    const content =
      summaryData.choices?.[0]?.message?.content || "{}";

    let clinicalJson: Record<string, string>;

    try {
      clinicalJson = JSON.parse(content);
    } catch {
      clinicalJson = {
        resumen_sesion: content,
        foco_trabajado: "",
        observaciones: "",
        tareas_acuerdos: "",
        proxima_sesion: "",
      };
    }

    return jsonResponse(req, {
      transcripcion,
      ...clinicalJson,
    });
  } catch (error) {
    const status =
      error instanceof HttpError ? error.status : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Error interno de procesamiento.";

    console.error(
      "procesar-audio-clinico:",
      message,
    );

    return jsonResponse(
      req,
      { error: message },
      status,
    );
  }
});