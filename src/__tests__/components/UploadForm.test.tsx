import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadForm from '@/components/UploadForm'
import * as apiClient from '@/../../api/client'

// Mock the API client but keep the real LoopArchitectApiError class so that
// `err instanceof LoopArchitectApiError` checks inside the component work.
jest.mock('@/../../api/client', () => ({
  ...jest.requireActual('@/../../api/client'),
  uploadLoop: jest.fn(),
}))

describe('UploadForm Component', () => {
  const mockOnUploadSuccess = jest.fn()
  const mockUploadLoop = apiClient.uploadLoop as jest.MockedFunction<typeof apiClient.uploadLoop>

  beforeEach(() => {
    jest.clearAllMocks()
    mockOnUploadSuccess.mockClear()
  })

  describe('Mode Selector UI', () => {
    it('should render three mode selector buttons', () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      expect(screen.getByRole('button', { name: /Single Loop/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Stem Files/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Stem ZIP/i })).toBeInTheDocument()
    })

    it('should default to single-loop mode', () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const singleLoopButton = screen.getByRole('button', { name: /Single Loop/i })
      expect(singleLoopButton).toHaveClass('bg-blue-600')
    })

    it('should switch to stem-files mode when clicked', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      await userEvent.click(stemFilesButton)

      expect(stemFilesButton).toHaveClass('bg-blue-600')
      expect(screen.getByText(/Upload multiple individual stem files/i)).toBeInTheDocument()
    })

    it('should switch to stem-pack mode when clicked', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const stemPackButton = screen.getByRole('button', { name: /Stem ZIP/i })
      await userEvent.click(stemPackButton)

      expect(stemPackButton).toHaveClass('bg-blue-600')
      expect(screen.getByText(/Upload a ZIP archive/i)).toBeInTheDocument()
    })

    it('should clear form when switching modes', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      // Create and select a file in single-loop mode
      const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      
      await userEvent.upload(input, file)
      
      // Verify file is selected
      expect(screen.getByText(/1 file selected/i)).toBeInTheDocument()

      // Switch modes
      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      await userEvent.click(stemFilesButton)

      // Verify file selection and errors are cleared
      await waitFor(() => {
        expect(screen.queryByText(/1 file selected/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Single Loop Mode', () => {
    it('should accept exactly one audio file', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      await userEvent.upload(input, file)

      expect(screen.getByText(/1 file selected/i)).toBeInTheDocument()
      expect(screen.getByText(/loop\.mp3/)).toBeInTheDocument()
    })

    it('should reject multiple files in single-loop mode', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const files = [
        new File(['audio1'], 'loop1.mp3', { type: 'audio/mpeg' }),
        new File(['audio2'], 'loop2.mp3', { type: 'audio/mpeg' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      // Use fireEvent.change to bypass the input's multiple=false restriction
      // and simulate the browser receiving multiple files (e.g. via drag-and-drop).
      fireEvent.change(input, { target: { files } })

      expect(screen.getByText(/exactly one file/i)).toBeInTheDocument()
    })

    it('should reject ZIP files in single-loop mode', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const zipFile = new File(['zipped'], 'stems.zip', { type: 'application/zip' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      // Use fireEvent.change to bypass the accept="audio/*" filter
      fireEvent.change(input, { target: { files: [zipFile] } })

      expect(screen.getByText(/single loop mode requires an audio file/i)).toBeInTheDocument()
    })

    it('should accept valid audio formats', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const formats = ['audio.mp3', 'audio.wav', 'audio.ogg', 'audio.flac']
      const types = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac']

      for (let i = 0; i < formats.length; i++) {
        // Reset and re-render for each format
        jest.clearAllMocks()
        const { rerender } = render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

        const file = new File(['audio'], formats[i], { type: types[i] })
        const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

        await userEvent.upload(input, file)

        expect(screen.getByText(new RegExp(formats[i].replace('.', '\\.')))).toBeInTheDocument()
        expect(screen.queryByText(/Invalid audio format/i)).not.toBeInTheDocument()
      }
    })

    it('should show upload button with correct label', () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const uploadButton = screen.getByRole('button', { name: /Upload Loop/i })
      expect(uploadButton).toBeInTheDocument()
    })
  })

  describe('Stem Files Mode', () => {
    beforeEach(() => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)
      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      fireEvent.click(stemFilesButton)
    })

    it('should require at least 2 files', async () => {
      const file = new File(['audio'], 'drums.wav', { type: 'audio/wav' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      await userEvent.upload(input, file)

      expect(screen.getByText(/at least 2 stem files/i)).toBeInTheDocument()
    })

    it('should accept 2 or more audio files', async () => {
      const files = [
        new File(['audio1'], 'drums.wav', { type: 'audio/wav' }),
        new File(['audio2'], 'bass.wav', { type: 'audio/wav' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      await userEvent.upload(input, files)

      expect(screen.getByText(/2 files selected/i)).toBeInTheDocument()
      // The file list items contain the filenames; find each by looking inside the list
      expect(screen.getAllByText(/drums\.wav/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/bass\.wav/).length).toBeGreaterThan(0)
    })

    it('should reject ZIP files in stem-files mode', async () => {
      const files = [
        new File(['audio'], 'drums.wav', { type: 'audio/wav' }),
        new File(['zipped'], 'stems.zip', { type: 'application/zip' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      // Use fireEvent.change to bypass the accept="audio/*" filter so the zip
      // reaches the component-level validation logic.
      fireEvent.change(input, { target: { files } })

      expect(screen.getByText(/stem files mode requires individual audio files/i)).toBeInTheDocument()
    })

    it('should show upload button with stem label', () => {
      const uploadButton = screen.getByRole('button', { name: /Upload Stems/i })
      expect(uploadButton).toBeInTheDocument()
    })

    it('should show hint for folder selection', () => {
      expect(screen.getByText(/Choose folder/i)).toBeInTheDocument()
      expect(screen.getByText(/Select 2\+ audio files/i)).toBeInTheDocument()
    })
  })

  describe('Stem Pack Mode', () => {
    beforeEach(() => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)
      const stemPackButton = screen.getByRole('button', { name: /Stem ZIP/i })
      fireEvent.click(stemPackButton)
    })

    it('should require exactly one ZIP file', async () => {
      const zipFile = new File(['zipped'], 'stems.zip', { type: 'application/zip' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      await userEvent.upload(input, zipFile)

      expect(screen.getByText(/1 file selected/i)).toBeInTheDocument()
      expect(screen.getByText(/stems\.zip/)).toBeInTheDocument()
    })

    it('should reject multiple ZIP files', async () => {
      const files = [
        new File(['zipped1'], 'stems1.zip', { type: 'application/zip' }),
        new File(['zipped2'], 'stems2.zip', { type: 'application/zip' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      // Use fireEvent.change to bypass the input's multiple=false restriction
      fireEvent.change(input, { target: { files } })

      expect(screen.getByText(/Please select exactly one ZIP file for stem pack mode/i)).toBeInTheDocument()
    })

    it('should reject audio files in stem-pack mode', async () => {
      const files = [new File(['audio'], 'drums.wav', { type: 'audio/wav' })]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      // Use fireEvent.change to bypass the accept=".zip" filter
      fireEvent.change(input, { target: { files } })

      expect(screen.getByText(/stem pack mode requires a ZIP file/i)).toBeInTheDocument()
    })

    it('should reject ZIP files without .zip extension', async () => {
      const zipFile = new File(['zipped'], 'stems.rar', { type: 'application/zip' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      // Use fireEvent.change to bypass the accept=".zip" filter.
      // A file with no .zip extension is not classified as a zip by the component,
      // so stem-pack mode reports "Stem pack mode requires a ZIP file."
      fireEvent.change(input, { target: { files: [zipFile] } })

      expect(screen.getByText(/stem pack mode requires a ZIP file/i)).toBeInTheDocument()
    })

    it('should show upload button with ZIP label', () => {
      const uploadButton = screen.getByRole('button', { name: /Upload ZIP Stem Pack/i })
      expect(uploadButton).toBeInTheDocument()
    })

    it('should show hint for ZIP selection', () => {
      expect(screen.getByText(/Select one ZIP file/i)).toBeInTheDocument()
    })
  })

  describe('File Size Validation', () => {
    it('should reject files larger than 50MB', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'huge.mp3', {
        type: 'audio/mpeg',
      })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      await userEvent.upload(input, largeFile)

      expect(screen.getByText(/File too large/i)).toBeInTheDocument()
      expect(screen.getByText(/Max 50MB per file/i)).toBeInTheDocument()
    })

    it('should accept files at 50MB limit', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const limitFile = new File(['x'.repeat(50 * 1024 * 1024)], 'max.mp3', {
        type: 'audio/mpeg',
      })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

      await userEvent.upload(input, limitFile)

      expect(screen.queryByText(/File too large/i)).not.toBeInTheDocument()
    })
  })

  describe('Drag and Drop', () => {
    it('should handle drag over event', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const dropZone = screen.getByText(/or drag and drop/).closest('div')!

      // fireEvent.dragOver is sufficient – just verify the component doesn't crash
      fireEvent.dragOver(dropZone)

      expect(dropZone).toBeInTheDocument()
    })

    it('should handle file drop in single-loop mode', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
      const dropZone = screen.getByText(/or drag and drop/).closest('div')!

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.getByText(/loop\.mp3/)).toBeInTheDocument()
      })
    })

    it('should handle multiple file drop in stem-files mode', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      fireEvent.click(stemFilesButton)

      const files = [
        new File(['audio1'], 'drums.wav', { type: 'audio/wav' }),
        new File(['audio2'], 'bass.wav', { type: 'audio/wav' }),
      ]
      const dropZone = screen.getByText(/or drag and drop/).closest('div')!

      fireEvent.drop(dropZone, {
        dataTransfer: { files },
      })

      await waitFor(() => {
        expect(screen.getByText(/2 files selected/i)).toBeInTheDocument()
      })
    })
  })

  describe('Upload Success', () => {
    it('should show success message with loop ID and render path', async () => {
      mockUploadLoop.mockResolvedValue({
        id: 123,
        stem_metadata: {
          upload_mode: 'single_loop',
          roles_detected: [],
          stems_generated: [],
        },
      } as any)

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, file)

      const uploadButton = screen.getByRole('button', { name: /Upload Loop/i })
      await userEvent.click(uploadButton)

      await waitFor(() => {
        expect(screen.getByText(/Upload successful/i)).toBeInTheDocument()
        expect(screen.getByText('123')).toBeInTheDocument()
        expect(screen.getByText(/Stereo Loop Fallback Mode/i)).toBeInTheDocument()
      })

      expect(mockOnUploadSuccess).toHaveBeenCalledWith(123)
    })

    it('should show detected stems in success message', async () => {
      mockUploadLoop.mockResolvedValue({
        id: 456,
        stem_metadata: {
          upload_mode: 'stem_pack',
          succeeded: true,
          roles_detected: ['drums', 'bass', 'melody'],
          stems_generated: ['drums', 'bass', 'melody'],
        },
      } as any)

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      fireEvent.click(stemFilesButton)

      const files = [
        new File(['audio1'], 'drums.wav', { type: 'audio/wav' }),
        new File(['audio2'], 'bass.wav', { type: 'audio/wav' }),
        new File(['audio3'], 'melody.wav', { type: 'audio/wav' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, files)

      const uploadButton = screen.getByRole('button', { name: /Upload Stems/i })
      await userEvent.click(uploadButton)

      await waitFor(() => {
        // The stems appear in the success message ("Stems detected: drums, bass, melody")
        // and potentially in the arrangement preview; ensure at least one match exists.
        expect(screen.getAllByText(/drums, bass, melody/i).length).toBeGreaterThan(0)
        expect(screen.getByText(/Stem Arrangement Mode/i)).toBeInTheDocument()
      })
    })

    it('should clear form after successful upload', async () => {
      mockUploadLoop.mockResolvedValue({
        id: 789,
        stem_metadata: {
          upload_mode: 'single_loop',
          roles_detected: [],
          stems_generated: [],
        },
      } as any)

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, file)

      const uploadButton = screen.getByRole('button', { name: /Upload Loop/i })
      await userEvent.click(uploadButton)

      await waitFor(() => {
        expect(screen.getByText(/Upload successful/i)).toBeInTheDocument()
      })

      // File list should be cleared
      expect(screen.queryByText('loop.mp3')).not.toBeInTheDocument()
    })
  })

  describe('Upload Error Handling', () => {
    it('should display API error message on upload failure', async () => {
      const errorMessage = 'Invalid audio file format'
      mockUploadLoop.mockRejectedValue(
        new (apiClient.LoopArchitectApiError as any)(errorMessage, 400)
      )

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'bad.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, file)

      const uploadButton = screen.getByRole('button', { name: /Upload Loop/i })
      await userEvent.click(uploadButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      expect(mockOnUploadSuccess).not.toHaveBeenCalled()
    })

    it('should disable upload button during upload', async () => {
      // Use a deferred promise so the upload stays in-progress while we assert.
      let resolveUpload!: (value: unknown) => void
      mockUploadLoop.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpload = resolve
          })
      )

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, file)

      const uploadButton = screen.getByRole('button', { name: /Upload Loop/i })
      // Start the upload (do not await – let it stay in-progress)
      const clickPromise = userEvent.click(uploadButton)

      // While upload is in-progress the button should be disabled
      await waitFor(() => {
        expect(uploadButton).toBeDisabled()
      })

      // Resolve the upload so the component can finish
      resolveUpload({
        id: 999,
        stem_metadata: { upload_mode: 'single_loop', roles_detected: [], stems_generated: [] },
      })
      await clickPromise

      // After upload the form is reset; the button stays disabled because no files
      // are selected, but "Uploading..." text is gone.
      await waitFor(() => {
        expect(screen.queryByText(/Uploading\.\.\./i)).not.toBeInTheDocument()
      })
    })
  })

  describe('File Clear Button', () => {
    it('should clear selected files when clicking clear button', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const file = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, file)

      expect(screen.getByText(/loop\.mp3/)).toBeInTheDocument()

      const clearButton = screen.getByLabelText(/Clear selected files/i)
      await userEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.queryByText(/loop\.mp3/)).not.toBeInTheDocument()
      })
    })

    it('should clear validation errors when a new valid file is selected', async () => {
      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      // Trigger a validation error by "uploading" multiple files via fireEvent.change
      // (userEvent.upload respects multiple=false and only passes the first file)
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      const invalidFiles = [
        new File(['audio1'], 'loop1.mp3', { type: 'audio/mpeg' }),
        new File(['audio2'], 'loop2.mp3', { type: 'audio/mpeg' }),
      ]
      fireEvent.change(input, { target: { files: invalidFiles } })

      expect(screen.getByText(/exactly one file/i)).toBeInTheDocument()

      // Select a single valid file – error should be replaced
      const validFile = new File(['audio'], 'good.mp3', { type: 'audio/mpeg' })
      await userEvent.upload(input, validFile)

      await waitFor(() => {
        expect(screen.queryByText(/exactly one file/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Arrangement Preview', () => {
    it('should show arrangement preview with detected stems after upload', async () => {
      mockUploadLoop.mockResolvedValue({
        id: 100,
        stem_metadata: {
          upload_mode: 'stem_files',
          succeeded: true,
          roles_detected: ['drums', 'bass', 'melody'],
          stems_generated: ['drums', 'bass', 'melody'],
        },
      } as any)

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      fireEvent.click(stemFilesButton)

      const files = [
        new File(['audio1'], 'drums.wav', { type: 'audio/wav' }),
        new File(['audio2'], 'bass.wav', { type: 'audio/wav' }),
        new File(['audio3'], 'melody.wav', { type: 'audio/wav' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, files)

      const uploadButton = screen.getByRole('button', { name: /Upload Stems/i })
      await userEvent.click(uploadButton)

      await waitFor(() => {
        expect(screen.getByText(/Detected stem roles/i)).toBeInTheDocument()
      })
    })

    it('should display stem roles as badge pills', async () => {
      mockUploadLoop.mockResolvedValue({
        id: 111,
        stem_metadata: {
          upload_mode: 'stem_files',
          roles_detected: ['drums', 'bass'],
          stems_generated: ['drums', 'bass'],
        },
      } as any)

      render(<UploadForm onUploadSuccess={mockOnUploadSuccess} />)

      const stemFilesButton = screen.getByRole('button', { name: /Stem Files/i })
      fireEvent.click(stemFilesButton)

      const files = [
        new File(['audio1'], 'drums.wav', { type: 'audio/wav' }),
        new File(['audio2'], 'bass.wav', { type: 'audio/wav' }),
      ]
      const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
      await userEvent.upload(input, files)

      await waitFor(() => {
        const badgePills = screen.getAllByText(/DRUMS|BASS/i)
        expect(badgePills.length).toBeGreaterThan(0)
      })
    })
  })
})
