/**
 * Compilación web con versión: genera la versión del despliegue (fecha y hora de Colombia + commit,
 * p. ej. "20261009.1432-eddca78"), la deja dentro de la app (EXPO_PUBLIC_APP_VERSION) y la publica en
 * dist/version.json. La app consulta ese archivo y se recarga sola cuando cambia
 * (src/components/update-watcher.tsx). Vercel usa este script como comando de compilación.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function gitCommit() {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const builtAt = new Date();
const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(builtAt)
    .map((p) => [p.type, p.value])
);
const commit = process.env.VERCEL_GIT_COMMIT_SHA || gitCommit();
const version = `${parts.year}${parts.month}${parts.day}.${parts.hour}${parts.minute}-${commit.slice(0, 7) || 'local'}`;

console.log(`Versión ${version}`);
execSync('npx expo export -p web', {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_APP_VERSION: version },
});
writeFileSync('dist/version.json', JSON.stringify({ version, commit, builtAt: builtAt.toISOString() }, null, 2));
