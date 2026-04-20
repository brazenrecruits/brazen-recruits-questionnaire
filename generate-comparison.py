"""
Generate a branded one-pager comparing Full Application vs Short Application.
Uses the BrazenRecruits dark/gold/olive military aesthetic.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import os

OUTPUT = "/sessions/tender-nifty-albattani/mnt/Kara's Recruiting Stuff/Application vs Short App Comparison.pdf"

# BrazenRecruits palette
BG_DARK = HexColor('#0C0D0A')
CARD_BG = HexColor('#1A1C16')
BORDER = HexColor('#2A2D22')
GOLD = HexColor('#C5A55A')
GOLD_LIGHT = HexColor('#DFC07F')
GOLD_DIM = HexColor('#9A7F3A')
WHITE = HexColor('#F0EDE6')
GRAY = HexColor('#8A8E96')
GRAY_LIGHT = HexColor('#B0B4BC')
OLIVE = HexColor('#4B5320')
OLIVE_HOVER = HexColor('#5C6628')
ROW_ALT_1 = HexColor('#14150F')
ROW_ALT_2 = HexColor('#1E201A')
TABLE_HEADER_BG = OLIVE
GREEN_YES = HexColor('#A8B84A')
MUTED_NO = HexColor('#555555')

yes_html = '<font color="#A8B84A"><b>Yes</b></font>'
no_html = '<font color="#555555">No</font>'

# Data rows
rows = [
    ('IDENTITY', 'Name, Email', yes_html, yes_html),
    ('', 'Gender, Age', no_html, yes_html),
    ('', 'Phone', no_html, yes_html),
    ('', 'Height, Weight', no_html, yes_html),
    ('', 'Race, Ethnicity', no_html, yes_html),
    ('', 'Date of Birth, SSN', no_html, yes_html),
    ('', 'Marital Status, Marriage Date', yes_html, yes_html),
    ('', 'Children Under 18', yes_html, yes_html),
    ('CITIZENSHIP\n& TRAVEL', 'Citizenship Status', no_html, yes_html),
    ('', 'Alien Registration #', no_html, yes_html),
    ('', 'Place of Birth', no_html, yes_html),
    ('', 'Dual Citizenship', no_html, yes_html),
    ('', 'U.S. Passport (# / Issued / Expires)', no_html, yes_html),
    ('', "Driver's License (# / State / Expires)", no_html, yes_html),
    ('', 'International Travel (7yr)', no_html, yes_html),
    ('', 'Registered Voter', no_html, yes_html),
    ('CHARACTER\nREFERENCES', '3 Non-Family References', no_html, yes_html),
    ('', 'Reference Addresses', no_html, yes_html),
    ('', '"Known Since" Dates (1 must be 7+ yr)', no_html, yes_html),
    ('RESIDENCES', 'Previous Addresses (10yr)', yes_html, yes_html),
    ('', 'Move-In / Move-Out Dates', yes_html, yes_html),
    ('', 'Verification Reference per Address', no_html, yes_html),
    ('EDUCATION', 'High School (Name, City, State)', yes_html, yes_html),
    ('', 'Graduation Date / Current Grade', yes_html, yes_html),
    ('', 'College Name & Degree', yes_html, yes_html),
    ('', 'Education Level (Highest)', no_html, yes_html),
    ('EMPLOYMENT', 'Current / Most Recent Employer', no_html, yes_html),
    ('', 'Job Title, Address, Dates', no_html, yes_html),
    ('', 'Supervisor Contact', no_html, yes_html),
    ('', 'Previous Employers (expandable)', no_html, yes_html),
    ('EMERGENCY\nCONTACT', 'Emergency Contact (name, phone, email)', yes_html, no_html),
    ('', 'Parent / Guardian (minors)', yes_html, no_html),
    ('BENEFICIARY', 'SGLI Beneficiaries (Primary + Contingent)', yes_html, no_html),
    ('', 'Beneficiary Addresses & Percentages', yes_html, no_html),
    ('MEDICAL', 'Insurance Provider & Address', yes_html, no_html),
    ('', 'Primary Care Doctor & Address', yes_html, no_html),
    ('', 'Tattoo Details', yes_html, no_html),
    ('SPOUSE &\nDEPENDENTS', 'Spouse Name, SSN, DOB, Address', yes_html, no_html),
    ('', 'Total & Minor Dependents Count', yes_html, no_html),
]


def draw_page_bg(canvas_obj, doc):
    """Draw the dark background on every page."""
    canvas_obj.saveState()
    canvas_obj.setFillColor(BG_DARK)
    canvas_obj.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)

    # Subtle gradient overlay at top
    for i in range(80):
        alpha = 0.06 * (1 - i / 80)
        canvas_obj.setFillColor(Color(0.29, 0.32, 0.12, alpha))
        y = letter[1] - i * 2
        canvas_obj.rect(0, y, letter[0], 2, fill=1, stroke=0)

    canvas_obj.restoreState()


def build_pdf():
    doc = SimpleDocTemplate(OUTPUT, pagesize=letter,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
        leftMargin=0.55*inch, rightMargin=0.55*inch)

    story = []

    # Styles
    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=22,
        textColor=WHITE, spaceAfter=2, alignment=TA_CENTER, leading=26)

    accent_style = ParagraphStyle('Accent', fontName='Helvetica-Bold', fontSize=9,
        textColor=GOLD, spaceAfter=0, alignment=TA_CENTER, leading=12,
        spaceBefore=0)

    subtitle_style = ParagraphStyle('Sub', fontName='Helvetica', fontSize=10,
        textColor=GRAY_LIGHT, spaceAfter=16, alignment=TA_CENTER, leading=14)

    cell_style = ParagraphStyle('Cell', fontName='Helvetica', fontSize=8.5,
        textColor=WHITE, leading=11)

    cell_bold = ParagraphStyle('CellBold', fontName='Helvetica-Bold', fontSize=8,
        textColor=GOLD, leading=11)

    header_style = ParagraphStyle('Header', fontName='Helvetica-Bold', fontSize=8.5,
        textColor=GOLD_LIGHT, leading=11)

    center_cell = ParagraphStyle('CenterCell', fontName='Helvetica', fontSize=8.5,
        textColor=WHITE, alignment=TA_CENTER, leading=11)

    small_gray = ParagraphStyle('SmallGray', fontName='Helvetica', fontSize=8,
        textColor=GRAY, leading=11)

    box_title = ParagraphStyle('BoxTitle', fontName='Helvetica-Bold', fontSize=10,
        textColor=GOLD, leading=13, spaceBefore=0, spaceAfter=2)

    box_url = ParagraphStyle('BoxURL', fontName='Helvetica', fontSize=8,
        textColor=GRAY, leading=10, spaceAfter=4)

    box_body = ParagraphStyle('BoxBody', fontName='Helvetica', fontSize=8.5,
        textColor=GRAY_LIGHT, leading=12)

    # ── HEADER ──
    story.append(Spacer(1, 6))
    story.append(Paragraph('TEXAS ARMY NATIONAL GUARD', accent_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph('Full Application vs. Short Application', title_style))
    story.append(Paragraph('Side-by-side comparison for SGT Andrews', subtitle_style))

    # ── SUMMARY BOXES ──
    summary_data = [
        [Paragraph('FULL APPLICATION', box_title),
         Paragraph('SHORT APPLICATION', box_title)],
        [Paragraph('application.brazenrecruits.com', box_url),
         Paragraph('shortapp.brazenrecruits.com', box_url)],
        [Paragraph('6 steps \u2014 Enlistment packet details: spouse info, emergency contact, '
                    'beneficiaries, medical/tattoos, education, and residence history.', box_body),
         Paragraph('4 steps \u2014 Pre-screening short app: full identity, citizenship, travel, '
                    'passport, 3 character references, residences with verification refs, '
                    'education, and employment history.', box_body)],
    ]

    summary_table = Table(summary_data, colWidths=[3.35*inch, 3.35*inch])
    summary_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (1,0), 8),
        ('TOPPADDING', (0,1), (-1,-1), 2),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,1), 2),
        ('BACKGROUND', (0,0), (0,-1), CARD_BG),
        ('BACKGROUND', (1,0), (1,-1), CARD_BG),
        ('BOX', (0,0), (0,-1), 0.75, BORDER),
        ('BOX', (1,0), (1,-1), 0.75, BORDER),
        # Gold top accent line on each box
        ('LINEABOVE', (0,0), (0,0), 2, GOLD_DIM),
        ('LINEABOVE', (1,0), (1,0), 2, GOLD_DIM),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # ── COMPARISON TABLE ──
    header = [
        Paragraph('CATEGORY', header_style),
        Paragraph('FIELD', header_style),
        Paragraph('FULL APP', ParagraphStyle('hc', fontName='Helvetica-Bold', fontSize=8.5,
            textColor=GOLD_LIGHT, alignment=TA_CENTER, leading=11)),
        Paragraph('SHORT APP', ParagraphStyle('hc', fontName='Helvetica-Bold', fontSize=8.5,
            textColor=GOLD_LIGHT, alignment=TA_CENTER, leading=11)),
    ]

    table_data = [header]
    for cat, field, full, short in rows:
        cat_p = Paragraph(cat, cell_bold) if cat else Paragraph('', cell_style)
        field_p = Paragraph(field, cell_style)
        full_p = Paragraph(full, center_cell)
        short_p = Paragraph(short, center_cell)
        table_data.append([cat_p, field_p, full_p, short_p])

    col_widths = [1.05*inch, 2.9*inch, 0.75*inch, 0.75*inch]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    style_commands = [
        # Header row
        ('BACKGROUND', (0,0), (-1,0), OLIVE),
        ('TEXTCOLOR', (0,0), (-1,0), GOLD_LIGHT),
        ('LINEBELOW', (0,0), (-1,0), 1.5, GOLD_DIM),
        # Grid
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        # Outer box with gold accent
        ('BOX', (0,0), (-1,-1), 1, HexColor('#3A3D30')),
        # Alternating row backgrounds
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [ROW_ALT_1, ROW_ALT_2]),
    ]

    # Merge category cells
    current_cat_start = 1
    for i in range(2, len(table_data)):
        cat_text = rows[i-1][0]
        if cat_text:
            if i - current_cat_start > 1:
                style_commands.append(('SPAN', (0, current_cat_start), (0, i-1)))
            current_cat_start = i
    if len(table_data) - current_cat_start > 1:
        style_commands.append(('SPAN', (0, current_cat_start), (0, len(table_data)-1)))

    table.setStyle(TableStyle(style_commands))
    story.append(table)

    story.append(Spacer(1, 14))

    # ── BOTTOM LINE ──
    # Gold thin line
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD_DIM, spaceAfter=10))

    bottom_style = ParagraphStyle('Bottom', fontName='Helvetica', fontSize=9,
        textColor=GRAY_LIGHT, leading=14)

    story.append(Paragraph(
        '<font color="#C5A55A"><b>Bottom line:</b></font> The two forms barely overlap. '
        'The <b>Short App</b> covers everything on the pre-screening form you sent me '
        '(identity, travel, citizenship, character references, residences with verification refs, '
        'education, and employment). The <b>Full App</b> covers enlistment packet extras '
        '(spouse details, emergency contact, beneficiaries, medical, tattoos). '
        'Let me know if you want to keep both, merge them into one, or replace the full app entirely.',
        bottom_style
    ))

    story.append(Spacer(1, 10))

    footer_style = ParagraphStyle('Footer', fontName='Helvetica', fontSize=7.5,
        textColor=GRAY, alignment=TA_CENTER, leading=10)
    story.append(Paragraph('SGT KARA ANDREWS \u2014 TEXAS ARMY NATIONAL GUARD \u2014 BRAZENRECRUITS.COM', footer_style))

    doc.build(story, onFirstPage=draw_page_bg, onLaterPages=draw_page_bg)
    print(f"PDF saved to: {OUTPUT}")


build_pdf()
