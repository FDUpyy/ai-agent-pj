import io
import os
from typing import Any, Dict

from docxtpl import DocxTemplate
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate


class DocumentGenerator:
    def generate_from_template(
        self, template_path: str, context_data: Dict[str, Any]
    ) -> io.BytesIO:
        """
        Reads a .docx template, replaces Jinja2 tags with context_data,
        and returns the generated file as a BytesIO stream.
        """
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")

        doc = DocxTemplate(template_path)
        doc.render(context_data)

        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        return file_stream

    def convert_to_pdf(self, content: str, title: str = "Document") -> io.BytesIO:
        """
        Converts text content (Markdown/Plain Text) to a simple PDF.
        Returns the PDF file as a BytesIO stream.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        # Add title
        story.append(Paragraph(title, styles["Title"]))
        
        # Add content paragraphs (splitting by newlines for basic formatting)
        for line in content.split("\n"):
            if line.strip():
                story.append(Paragraph(line, styles["Normal"]))

        doc.build(story)
        buffer.seek(0)
        return buffer
