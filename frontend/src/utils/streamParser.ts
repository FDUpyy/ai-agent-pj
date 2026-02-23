export interface Artifact {
  title: string
  type: string
  filename: string
  content: string
}

export interface ParseResult {
  displayContent: string
  artifact: Artifact | null
  isParsingArtifact: boolean
}

export class StreamParser {
  private buffer = ""
  private displayContent = ""
  private artifact: Artifact | null = null
  private isParsingArtifact = false

  parse(chunk: string): ParseResult {
    this.buffer += chunk

    // Check for artifact start tag
    if (!this.isParsingArtifact) {
      const startTagMatch = this.buffer.match(/<artifact\s+([^>]+)>/)
      if (startTagMatch) {
        const fullTag = startTagMatch[0]
        const attributesStr = startTagMatch[1]
        const preTagContent = this.buffer.substring(0, startTagMatch.index)

        // Add content before the tag to display content
        this.displayContent += preTagContent
        
        // Parse attributes
        const titleMatch = attributesStr.match(/title="([^"]*)"/)
        const typeMatch = attributesStr.match(/type="([^"]*)"/)
        const filenameMatch = attributesStr.match(/filename="([^"]*)"/)

        this.artifact = {
          title: titleMatch ? titleMatch[1] : "Untitled",
          type: typeMatch ? typeMatch[1] : "text/plain",
          filename: filenameMatch ? filenameMatch[1] : "artifact.txt",
          content: "",
        }

        this.isParsingArtifact = true
        // Remove processed part from buffer
        this.buffer = this.buffer.substring(startTagMatch.index! + fullTag.length)
      } else {
        // If no tag found yet, but buffer is getting long, maybe safe to move some to display
        // But be careful not to break a partial tag like "<arti"
        // For simplicity, we just keep appending to displayContent if we are sure it's not a tag
        // Optimization: only keep the last 20 chars in buffer if no partial tag detected
        if (!this.buffer.includes("<")) {
            this.displayContent += this.buffer
            this.buffer = ""
        }
      }
    }

    // Check for artifact end tag
    if (this.isParsingArtifact) {
      const endTagIndex = this.buffer.indexOf("</artifact>")
      if (endTagIndex !== -1) {
        // Found end tag
        const content = this.buffer.substring(0, endTagIndex)
        if (this.artifact) {
            this.artifact.content += content
        }
        
        this.isParsingArtifact = false
        // Remove processed part from buffer (including end tag)
        this.buffer = this.buffer.substring(endTagIndex + "</artifact>".length)
      } else {
        // No end tag yet, everything in buffer is artifact content
        // BUT we need to be careful about partial end tags like "</artifa"
        // So we keep the last few chars in buffer just in case
        const safeLength = Math.max(0, this.buffer.length - 15)
        const content = this.buffer.substring(0, safeLength)
        if (this.artifact) {
            this.artifact.content += content
        }
        this.buffer = this.buffer.substring(safeLength)
      }
    }

    return {
      displayContent: this.displayContent + (this.isParsingArtifact ? "" : this.buffer),
      artifact: this.artifact,
      isParsingArtifact: this.isParsingArtifact,
    }
  }
  
  reset() {
      this.buffer = ""
      this.displayContent = ""
      this.artifact = null
      this.isParsingArtifact = false
  }
}
