import React from "react"
import Editor from "@monaco-editor/react"

interface CodeEditorProps {
  code: string
  language?: string
  onChange?: (value: string | undefined) => void
}

export function CodeEditor({
  code,
  language = "markdown",
  onChange,
}: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage={language}
      language={language}
      value={code}
      onChange={onChange}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        wordWrap: "on",
        scrollBeyondLastLine: false,
        fontSize: 14,
        padding: { top: 16, bottom: 16 },
      }}
    />
  )
}
