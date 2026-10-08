import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { request } from './api'
import { native } from './storage'
export async function exportData(data) {
  const revisions = {}
  for (const id of Object.keys(data.knowledge)) revisions[id] = (await request(`/api/memory?id=${id}`)).revisions
  const value = JSON.stringify({ exportedAt: new Date().toISOString(), entries: Object.values(data.entries), knowledge: Object.values(data.knowledge), reminders: Object.values(data.reminders), revisions, unsynced: data.outbox, drafts: data.drafts }, null, 2)
  if (native) {
    const path = 'pocket-memory-export.json'
    const file = await Filesystem.writeFile({ path, data: value, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try { await Share.share({ title: 'Pocket Memory export', files: [file.uri] }) }
    finally { await Filesystem.deleteFile({ path, directory: Directory.Cache }) }
  } else {
    const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'pocket-memory-export.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
