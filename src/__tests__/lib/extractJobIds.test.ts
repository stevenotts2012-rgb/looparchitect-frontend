import { extractJobIds } from '@/lib/extractJobIds'

describe('extractJobIds', () => {
  it('extracts from { job_id }', () => {
    expect(extractJobIds({ job_id: 'job-1' })).toEqual(['job-1'])
  })

  it('extracts from { id }', () => {
    expect(extractJobIds({ id: 'job-2' })).toEqual(['job-2'])
  })

  it('extracts from { jobs: [{ job_id }] }', () => {
    expect(extractJobIds({ jobs: [{ job_id: 'job-3' }] })).toEqual(['job-3'])
  })

  it('extracts from { jobs: [{ id }] }', () => {
    expect(extractJobIds({ jobs: [{ id: 'job-4' }] })).toEqual(['job-4'])
  })

  it('extracts from { job_ids: [...] }', () => {
    expect(extractJobIds({ job_ids: ['job-5', 'job-6'] })).toEqual(['job-5', 'job-6'])
  })

  it('returns [] for invalid shapes', () => {
    expect(extractJobIds({ ok: true })).toEqual([])
    expect(extractJobIds(null)).toEqual([])
  })
})
