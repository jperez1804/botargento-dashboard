// Minimal HTML magic-link email. Rendered inline (no template library) so the
// container stays lean. Match the dashboard look: Geist Sans, white surface,
// neutral text, primary-colored button.

type RenderArgs = {
  url: string;
  clientName: string;
};

export function renderMagicLinkEmail({ url, clientName }: RenderArgs): string {
  const safeName = escapeHtml(clientName);
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Acceso a ${safeName}</title>
  </head>
  <body style="margin:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Geist','Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">Tu acceso a ${safeName}</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
          Hacé click en el botón para iniciar sesión en el panel de reportes.
          Este link es de un solo uso y vence en 15 minutos.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${safeUrl}"
             style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:500;">
            Ingresar al panel
          </a>
        </p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
          Si no solicitaste este acceso, podés ignorar este mensaje.
        </p>
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#9ca3af;">
        BotArgento · Panel de reportes
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
