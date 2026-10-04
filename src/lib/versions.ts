import { useEffect, useState } from 'react';
import type { Lang } from './catalog.ts';

interface Versions {
  ko: string | null;
  global: string | null;
}

let pending: Promise<Versions> | null = null;

function load(): Promise<Versions> {
  pending ??= fetch('/data/versions.json')
    .then((r) => r.json() as Promise<Versions>)
    .catch(() => ({ ko: null, global: null }));
  return pending;
}

/**
 * Korean players are on the Korean client, which runs a patch or two behind, so
 * a Korean reader needs the Korean number. Japanese and English readers are both
 * on the global client.
 */
export function versionFor(versions: Versions, lang: Lang): string | null {
  return lang === 'ko' ? versions.ko : versions.global;
}

export function useVersions(): Versions {
  const [versions, setVersions] = useState<Versions>({ ko: null, global: null });
  useEffect(() => {
    load().then(setVersions);
  }, []);
  return versions;
}
