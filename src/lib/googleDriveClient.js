const SCOPES = "https://www.googleapis.com/auth/drive.file";

export function cargarGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = resolve;
    script.onerror = reject;

    document.body.appendChild(script);
  });
}

export async function obtenerAccessTokenGoogle() {
    await cargarGoogleIdentityScript();
  
    const tokenGuardado = localStorage.getItem("mentalia_google_access_token");
    const expiraEn = localStorage.getItem("mentalia_google_token_expira_en");
  
    if (tokenGuardado && expiraEn && Date.now() < Number(expiraEn)) {
      return tokenGuardado;
    }
  
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: SCOPES,
  
        callback: (response) => {
          if (response.error) {
            reject(response);
            return;
          }
  
          const accessToken = response.access_token;
  
          const expiresInMs = (response.expires_in || 3600) * 1000;
  
          localStorage.setItem(
            "mentalia_google_access_token",
            accessToken
          );
  
          localStorage.setItem(
            "mentalia_google_token_expira_en",
            String(Date.now() + expiresInMs - 60000)
          );
  
          resolve(accessToken);
        },
      });
  
      client.requestAccessToken({
        prompt: "",
      });
    });
  }

async function buscarCarpeta(accessToken, nombre, parentId = null) {
  const parentQuery = parentId
    ? ` and '${parentId}' in parents`
    : "";

  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${nombre}' and trashed=false${parentQuery}`
  );

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  return data.files?.[0] || null;
}

async function crearCarpeta(accessToken, nombre, parentId = null) {
  const metadata = {
    name: nombre,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  return response.json();
}

export async function obtenerOCrearCarpeta(
  accessToken,
  nombre,
  parentId = null
) {
  const existente = await buscarCarpeta(
    accessToken,
    nombre,
    parentId
  );

  if (existente) return existente;

  return crearCarpeta(accessToken, nombre, parentId);
}

export async function subirJsonSesionDrive({
  accessToken,
  paciente,
  cita,
  sesion,
}) {
  const carpetaMentalia = await obtenerOCrearCarpeta(
    accessToken,
    "Mentalia"
  );

  const carpetaPacientes = await obtenerOCrearCarpeta(
    accessToken,
    "pacientes",
    carpetaMentalia.id
  );

  const carpetaPacienteNombre = `paciente_${paciente.id}`;

  const carpetaPaciente = await obtenerOCrearCarpeta(
    accessToken,
    carpetaPacienteNombre,
    carpetaPacientes.id
  );

  const carpetaSesiones = await obtenerOCrearCarpeta(
    accessToken,
    "sesiones",
    carpetaPaciente.id
  );

  const fecha =
    cita.fecha?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  const hora =
    cita.hora_inicio?.slice(0, 5)?.replace(":", "") || "0000";

  const nombreArchivo = `${fecha}_${hora}_sesion.json`;

  const contenido = {
    version: "1.0",
    app: "Mentalia",
    storage_provider: "google_drive",

    paciente: {
      id: paciente.id,
      referencia: "paciente_asociado_en_mentalia",
    },

    cita: {
      id: cita.id,
      fecha: cita.fecha,
      hora_inicio: cita.hora_inicio,
      hora_fin: cita.hora_fin,
      estado: cita.estado,
    },

    sesion,

    auditoria: {
      fecha_exportacion: new Date().toISOString(),
    },
  };

  const metadata = {
    name: nombreArchivo,
    mimeType: "application/json",
    parents: [carpetaSesiones.id],
  };

  const boundary = "-------MentaliaBoundary";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(contenido, null, 2) +
    closeDelimiter;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const archivo = await response.json();

  return {
    fileId: archivo.id,
    fileName: archivo.name,
    webViewLink: archivo.webViewLink,
    path: `Mentalia/pacientes/${carpetaPacienteNombre}/sesiones/${nombreArchivo}`,
  };
}

export async function leerJsonSesionDrive({ accessToken, fileId }) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
  
    return response.json();
  }

  export async function actualizarJsonSesionDrive({
    accessToken,
    fileId,
    contenido,
  }) {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contenido, null, 2),
      }
    );
  
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
  
    return response.json();
  }
  