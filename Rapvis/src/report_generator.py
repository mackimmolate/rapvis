
import os
import sys
from fpdf import FPDF
import tempfile
from datetime import datetime
import pandas as pd

class PDFReport(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 15)
        self.cell(0, 10, 'Efterfrågeanalys Rapport', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.cell(0, 10, f'Sida {self.page_no()}', 0, 0, 'C')

def generate_pdf_report(figure, table_data, filename="report.pdf"):
    pdf = PDFReport()
    pdf.add_page()

    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, f"Skapad: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 0, 1)
    pdf.ln(5)

    # 1. Capture Graph
    temp_image_path = os.path.join(tempfile.gettempdir(), "rapvis_graph.png")

    if figure:
        figure.savefig(temp_image_path, dpi=100, bbox_inches='tight')
        pdf.image(temp_image_path, x=10, y=40, w=190)
        pdf.ln(110) # Move cursor down past image
    else:
        pdf.cell(0, 10, "[Graf saknas]", 0, 1)

    # 2. Add Insights/Table
    pdf.set_font("Helvetica", 'B', 14)
    pdf.cell(0, 10, "Toppartiklar (Urval)", 0, 1)

    pdf.set_font("Helvetica", size=10)

    # Table Header
    col_width = 45
    pdf.set_fill_color(200, 220, 255)
    headers = ["Artikel", "Nuvarande", "Historik", "Differens"]
    for h in headers:
        pdf.cell(col_width, 10, h, 1, 0, 'C', True)
    pdf.ln()

    # Table Rows (Top 20 to avoid overflow)
    for index, row in table_data.head(20).iterrows():
        pdf.cell(col_width, 10, str(row.iloc[0]), 1)
        pdf.cell(col_width, 10, f"{row['Current']:,.0f}".replace(",", " "), 1, 0, 'R')
        pdf.cell(col_width, 10, f"{row['History']:,.0f}".replace(",", " "), 1, 0, 'R')
        pdf.cell(col_width, 10, f"{row['Diff']:,.0f}".replace(",", " "), 1, 0, 'R')
        pdf.ln()

    try:
        pdf.output(filename)
        return True, filename
    except Exception as e:
        return False, str(e)
