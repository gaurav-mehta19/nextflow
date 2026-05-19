import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'proj_mxldgpzdlriqvbgiznaa',
  dirs: ['./src/trigger'],
  maxDuration: 300,
  retries: {
    // Retry transient failures (e.g. Gemini 503/429) even in dev so the demo isn't disrupted
    enabledInDev: true,
    default: {
      maxAttempts: 4,
      minTimeoutInMs: 3000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
})
