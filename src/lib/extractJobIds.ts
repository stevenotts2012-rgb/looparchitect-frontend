export function extractJobIds(renderResponse: unknown): string[] {
  if (!renderResponse || typeof renderResponse !== 'object') {
    return []
  }

  const response = renderResponse as Record<string, unknown>
  const jobIds: string[] = []

  const pushIfString = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      jobIds.push(value)
    }
  }

  pushIfString(response.job_id)
  pushIfString(response.id)

  if (Array.isArray(response.jobs)) {
    for (const job of response.jobs) {
      if (!job || typeof job !== 'object') continue
      const jobRecord = job as Record<string, unknown>
      pushIfString(jobRecord.job_id)
      pushIfString(jobRecord.id)
    }
  }

  if (Array.isArray(response.job_ids)) {
    for (const jobId of response.job_ids) {
      pushIfString(jobId)
    }
  }

  return Array.from(new Set(jobIds))
}
