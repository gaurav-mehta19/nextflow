interface AssemblyStatus {
  ok?: string
  error?: string
  message?: string
  results?: Record<string, Array<{ ssl_url: string }>>
  uploads?: Array<{ ssl_url: string }>
}

export async function uploadToTransloadit(file: File): Promise<string> {
  // 1. Get a server-signed assembly so we never expose the Transloadit secret to the browser.
  const signRes = await fetch('/api/transloadit/sign', { method: 'POST' })
  if (!signRes.ok) throw new Error('Failed to sign Transloadit assembly')
  const { params, signature } = (await signRes.json()) as { params: string; signature: string }

  // 2. POST the file directly to Transloadit.
  const form = new FormData()
  form.append('params', params)
  form.append('signature', signature)
  form.append('file', file)

  const uploadRes = await fetch('https://api2.transloadit.com/assemblies', {
    method: 'POST',
    body: form,
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '')
    throw new Error(
      `Transloadit upload failed: HTTP ${uploadRes.status} — ${body.slice(0, 300)}`
    )
  }
  const assembly = (await uploadRes.json()) as {
    assembly_id: string
    assembly_ssl_url: string
  } & AssemblyStatus

  // The initial response may already be complete if processing is instant.
  if (assembly.ok === 'ASSEMBLY_COMPLETED') {
    const url = pickResultUrl(assembly)
    if (url) return url
  }
  if (assembly.error) {
    throw new Error(`Transloadit error: ${assembly.error}${assembly.message ? ` — ${assembly.message}` : ''}`)
  }

  // 3. Poll until complete.
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    const statusRes = await fetch(assembly.assembly_ssl_url)
    if (!statusRes.ok) continue
    const status = (await statusRes.json()) as AssemblyStatus
    if (status.ok === 'ASSEMBLY_COMPLETED') {
      const url = pickResultUrl(status)
      if (!url) throw new Error('Transloadit completed but no upload URL returned')
      return url
    }
    if (status.error) {
      throw new Error(`Transloadit error: ${status.error}${status.message ? ` — ${status.message}` : ''}`)
    }
  }
  throw new Error('Transloadit upload timed out')
}

function pickResultUrl(status: AssemblyStatus): string | undefined {
  return (
    status.results?.stored?.[0]?.ssl_url ??
    status.uploads?.[0]?.ssl_url
  )
}
