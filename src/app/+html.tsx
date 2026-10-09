import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * HTML base de la versión web (solo web; en la app nativa no aplica).
 *
 * En los navegadores del celular (Safari y Chrome en iPhone, Chrome en Android) `height: 100%` toma el
 * alto "grande" de la pantalla, que incluye la zona que tapan las barras del navegador: la barra de
 * pestañas de abajo quedaba cortada. `100dvh` es el alto visible real. `viewport-fit=cover` habilita
 * las zonas seguras (muesca y barra de inicio del iPhone), que la app ya respeta.
 */
const VIEWPORT_CSS = `
@supports (height: 100dvh) {
  html, body, #root { height: 100dvh; }
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#FFFFFF" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: VIEWPORT_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
