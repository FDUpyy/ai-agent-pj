import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect } from 'react'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered } from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange?: (html: string) => void
  readOnly?: boolean
}

export const RichTextEditor = ({ content, onChange, readOnly = false }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    editorProps: {
        attributes: {
            class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none max-w-none',
        },
    },
  })

  // Sync content from props if changed externally (e.g. from AI stream)
  // We need to be careful not to overwrite user edits if they are typing
  // But for the "streaming" case, we want to update.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
        // Only update if content is significantly different to avoid cursor jumps
        // For simple streaming, we might just setContent
        // For a real collaborative feel, we'd need Yjs, but here we just setContent
        // We only set if the difference is likely from AI generation (append)
        // For now, let's just set it if it's different.
        
        // Check if editor is focused to avoid disrupting user
        if (!editor.isFocused) {
            editor.commands.setContent(content)
        } else {
             // If user is typing, we might conflict. 
             // In this app design, AI generates -> User edits.
             // If AI is streaming, user probably shouldn't edit yet.
             // We can force update.
             const currentPos = editor.state.selection.anchor
             editor.commands.setContent(content)
             editor.commands.setTextSelection(currentPos)
        }
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/50">
            <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('bold') ? 'bg-slate-200 text-black' : 'text-slate-500'}`}
            title="加粗"
            >
            <Bold className="w-4 h-4" />
            </button>
            <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('italic') ? 'bg-slate-200 text-black' : 'text-slate-500'}`}
            title="斜体"
            >
            <Italic className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-200 text-black' : 'text-slate-500'}`}
            title="标题 1"
            >
            <Heading1 className="w-4 h-4" />
            </button>
            <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 text-black' : 'text-slate-500'}`}
            title="标题 2"
            >
            <Heading2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 text-black' : 'text-slate-500'}`}
            title="无序列表"
            >
            <List className="w-4 h-4" />
            </button>
            <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('orderedList') ? 'bg-slate-200 text-black' : 'text-slate-500'}`}
            title="有序列表"
            >
            <ListOrdered className="w-4 h-4" />
            </button>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
