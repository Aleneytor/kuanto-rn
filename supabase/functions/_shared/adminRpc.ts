function getSecretKey(): string {
  const localKey = Deno.env.get('SUPABASE_SECRET_KEY');
  if (localKey?.startsWith('sb_secret_')) return localKey;

  const namedKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (namedKeys) {
    try {
      const keys = JSON.parse(namedKeys) as Record<string, string>;
      if (keys.default?.startsWith('sb_secret_')) return keys.default;
    } catch {
      // Se informa con un error genérico debajo para no filtrar configuración.
    }
  }

  throw new Error('No new Supabase secret key is available to the function.');
}

export async function callAdminRpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const projectUrl = Deno.env.get('SUPABASE_URL');
  if (!projectUrl) throw new Error('SUPABASE_URL is unavailable.');

  const response = await fetch(`${projectUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: getSecretKey(),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RPC ${name} failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}
