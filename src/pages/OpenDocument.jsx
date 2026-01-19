import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import DocumentFeed from '@/components/features/DocumentFeed'
import { Badge } from '@/components/ui/badge'
import useDocuments from '@/hooks/useDocuments'
import { useNavigate } from 'react-router-dom'
import { Textarea } from '@/components/ui/textarea'

export default function OpenDocument() {
    const navigate = useNavigate()
    const { docId } = useParams()
    const userDocuments = useDocuments()
    const document = userDocuments.getDocument(docId)

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')

    useEffect(() => {
        if (!document && docId) {
            navigate('/browse')
        } else if (document) {
            setTitle(document.docTitle || '')
            setContent(document.docContent || '')
        }
    }, [document, docId, navigate])

    const handleContentChange = (e) => {
        const newContent = e.target.value
        setContent(newContent)
        userDocuments.modifyDocument(docId, { docContent: newContent })
    }

    const handleTitleChange = (e) => {
        const newTitle = e.target.value
        setTitle(newTitle)
        userDocuments.modifyDocument(docId, { docTitle: newTitle })
    }

    if (!document) return null

    return (
        <div className="min-h-dvh flex flex-col pt-[max(48px,env(safe-area-inset-top))] px-6 pb-32 max-w-4xl mx-auto w-full">
            <header className="mb-8 flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium cursor-pointer"
                >
                    ← Back
                </button>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {document.docType.toUpperCase()}
                </Badge>
            </header>

            <div className="flex-1 flex flex-col gap-6">
                <input
                    value={title}
                    onChange={handleTitleChange}
                    className="text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/20 w-full"
                    placeholder="Document Title"
                />

                <div className="flex-1 flex flex-col">
                    {document.docType === "list" ? (
                        <div className="space-y-2">
                            {content.split('\n').map((item, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-secondary/20">
                                    <div className="w-2 h-2 rounded-full bg-primary/40" />
                                    <span className="text-lg">{item}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Textarea
                            value={content}
                            onChange={handleContentChange}
                            placeholder="Start writing..."
                            className="text-xl leading-relaxed p-0 min-h-[400px]"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
