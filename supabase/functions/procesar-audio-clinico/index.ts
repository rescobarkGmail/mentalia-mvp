import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY no está configurada.");
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof File)) {
      throw new Error("No se recibió archivo de audio.");
    }

    const transcriptionForm = new FormData();
    transcriptionForm.append("file", audioFile, "sesion.webm");
    transcriptionForm.append("model", "whisper-1");
    transcriptionForm.append("language", "es");
    transcriptionForm.append(
      "prompt",
      "Terminología clínica psicológica en español. Palabras frecuentes: ansiedad, depresión, regulación emocional, terapia, emociones, autoestima, estrés, pensamientos automáticos."
    );
    
    const transcriptionResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: transcriptionForm,
      }
    );

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      throw new Error("Error en transcripción: " + errorText);
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcripcion = transcriptionData.text || "";

    const prompt = `
Eres un asistente clínico-administrativo para psicólogos.
No diagnostiques, no reemplaces criterio profesional y no inventes información.
Tu tarea es estructurar una transcripción de sesión psicológica en un borrador editable.

Devuelve SOLO JSON válido, sin markdown, con esta estructura exacta:

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

    const resumenResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente clínico-administrativo. Respondes solo con JSON válido.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    if (!resumenResponse.ok) {
      const errorText = await resumenResponse.text();
      throw new Error("Error en resumen clínico: " + errorText);
    }

    const resumenData = await resumenResponse.json();
    const content = resumenData.choices?.[0]?.message?.content || "{}";

    let jsonClinico;

    try {
      jsonClinico = JSON.parse(content);
    } catch {
      jsonClinico = {
        resumen_sesion: content,
        foco_trabajado: "",
        observaciones: "",
        tareas_acuerdos: "",
        proxima_sesion: "",
      };
    }

    return new Response(
      JSON.stringify({
        transcripcion,
        ...jsonClinico,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});