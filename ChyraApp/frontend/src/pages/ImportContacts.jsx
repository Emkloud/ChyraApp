import { useState } from 'react'
import client from '../services/api'

function normalizePhone(raw) {
  return (raw || '').replace(/[^\d+]/g, '')
}

async function sha256Hex(input) {
  const enc = new TextEncoder()
  const data = enc.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function parseVCF(text) {
  const contacts = []
  const cards = text.split(/END:VCARD/i)
  for (const card of cards) {
    const lines = card.split(/\r?\n/)
    let name = ''
    let phone = ''
    for (const line of lines) {
      if (/^FN[:;]/i.test(line)) {
        const parts = line.split(':')
        name = (parts[1] || '').trim()
      }
      if (/^TEL/i.test(line)) {
        const parts = line.split(':')
        phone = (parts[1] || '').trim()
      }
    }
    if (phone) {
      contacts.push({ name: name || phone, phone })
    }
  }
  return contacts
}

function parseCSV(text) {
  // Expect headers like: name,phone (case-insensitive)
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const idxName = header.findIndex(h => h.includes('name'))
  const idxPhone = header.findIndex(h => h.includes('phone') || h === 'tel')
  const contacts = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const name = idxName >= 0 ? cols[idxName]?.trim() : ''
    const phone = idxPhone >= 0 ? cols[idxPhone]?.trim() : ''
    if (phone) contacts.push({ name: name || phone, phone })
  }
  return contacts
}

export default function ImportContacts() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const onFileChange = async (e) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setPreview([])
    setMessage('')
    if (!f) return

    const text = await f.text()

    let contacts = []
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (ext === 'vcf' || text.includes('BEGIN:VCARD')) {
      contacts = parseVCF(text)
    } else {
      contacts = parseCSV(text)
    }
    setPreview(contacts.slice(0, 50))
  }

  const onImport = async () => {
    if (!file) return
    setUploading(true)
    setMessage('')
    try {
      const text = await file.text()
      let contacts = []
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (ext === 'vcf' || text.includes('BEGIN:VCARD')) {
        contacts = parseVCF(text)
      } else {
        contacts = parseCSV(text)
      }
      // Normalize + hash
      const hashed = []
      for (const c of contacts) {
        const normalized = normalizePhone(c.phone)
        if (!normalized) continue
        const phoneHash = await sha256Hex(normalized)
        hashed.push({ name: c.name || normalized, phoneHash })
      }
      if (hashed.length === 0) {
        setMessage('No valid phone numbers found in file.')
        setUploading(false)
        return
      }
      const res = await client.post('/contacts/sync', { contacts: hashed })
      setMessage(`Imported ${hashed.length} contact(s). Matched: ${res?.data?.total ?? 0}`)
    } catch (e) {
      setMessage(`Import failed: ${e?.response?.data?.message || e?.message || 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Import Contacts</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Upload a .vcf (vCard) or .csv file with your contacts. We'll hash phone numbers client-side before syncing.
      </p>
      <input
        id="contactsFile"
        name="contactsFile"
        type="file"
        accept=".vcf,.csv,text/csv,text/vcard"
        onChange={onFileChange}
        className="mb-4"
      />
      {preview.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">Preview ({preview.length} of {preview.length})</div>
          <div className="max-h-40 overflow-auto border rounded p-2 text-sm">
            {preview.map((c, i) => (
              <div key={i} className="flex justify-between border-b last:border-b-0 py-1">
                <span>{c.name}</span>
                <span className="text-gray-500">{c.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={onImport}
        disabled={!file || uploading}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {uploading ? 'Importing...' : 'Import & Sync'}
      </button>
      {message && <div className="mt-4 text-sm">{message}</div>}
    </div>
  )
}
