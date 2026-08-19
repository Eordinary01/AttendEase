from weasyprint import HTML
import markdown
import os

files = [
    r"C:\Users\Parth Manocha\Desktop\DEV\attendease_\docs\Synopsis_BTech_AttendEase.md",
    r"C:\Users\Parth Manocha\Desktop\DEV\attendease_\docs\Report_BTech_AttendEase.md",
]

css = """
@page { size: A4; margin: 2.54cm 2.54cm 2.54cm 3.81cm; }
body {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #000;
}
h1 {
  font-size: 18pt;
  font-weight: bold;
  text-align: left;
  margin-top: 24pt;
  margin-bottom: 12pt;
  border-bottom: 2.25pt solid black;
  page-break-after: avoid;
}
h2 {
  font-size: 16pt;
  font-weight: bold;
  text-align: left;
  margin-top: 18pt;
  margin-bottom: 9pt;
  page-break-after: avoid;
}
h3 {
  font-size: 14pt;
  font-weight: bold;
  text-align: left;
  margin-top: 14pt;
  margin-bottom: 7pt;
  page-break-after: avoid;
}
h4, h5, h6 {
  font-size: 12pt;
  font-weight: bold;
  margin-top: 12pt;
  margin-bottom: 6pt;
  page-break-after: avoid;
}
p {
  text-align: justify;
  margin: 0 0 6pt 0;
  orphans: 2; widows: 2;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 12pt 0;
  font-size: 11pt;
  page-break-inside: auto;
}
tr { page-break-inside: avoid; }
th, td {
  border: 1px solid #333;
  padding: 6pt;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f2f2f2;
  font-weight: bold;
}
thead { display: table-header-group; }
ul, ol {
  margin: 6pt 0;
  padding-left: 24pt;
}
li { margin-bottom: 3pt; }
pre, code {
  font-family: Consolas, Monaco, monospace;
  font-size: 10pt;
  background: #f5f5f5;
  padding: 8pt;
  white-space: pre-wrap;
  word-break: break-word;
}
img { max-width: 100%; height: auto; display: block; margin: 12pt auto; }
.page-break { page-break-before: always; }
.center { text-align: center; }
.italic { font-style: italic; }
strong { font-weight: bold; }
"""

for md_path in files:
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()
    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "nl2br"])
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{"AttendEase Synopsis" if "Synopsis" in md_path else "AttendEase Report"}</title>
<style>
{css}
</style>
</head>
<body>
{body}
</body>
</html>"""
    pdf_path = md_path.replace(".md", ".pdf")
    HTML(string=html, base_url=os.path.dirname(md_path)).write_pdf(pdf_path)
    print("Generated:", pdf_path, "size:", os.path.getsize(pdf_path), "bytes")
