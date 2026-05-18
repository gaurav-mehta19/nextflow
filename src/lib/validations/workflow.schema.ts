import { z } from 'zod'

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
})

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
})

export const RunWorkflowSchema = z.object({
  scope: z.enum(['full', 'partial', 'single']),
  selectedNodeIds: z.array(z.string()).optional(),
  inputValues: z.record(z.string(), z.unknown()),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
})

export const ImportWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
})

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>
export type RunWorkflowInput = z.infer<typeof RunWorkflowSchema>
export type ImportWorkflowInput = z.infer<typeof ImportWorkflowSchema>
