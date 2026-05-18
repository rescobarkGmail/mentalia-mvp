export function formatearFecha(fechaTexto) {
    if (!fechaTexto) return "";
  
    const fecha = new Date(fechaTexto);
  
    return fecha.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  
  export function formatearFechaHora(fechaTexto) {
    if (!fechaTexto) return "";
  
    const fecha = new Date(fechaTexto);
  
    return fecha.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }