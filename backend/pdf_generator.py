import io
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, Rect, Circle, String as DString

try:
    from reportlab.platypus.flowables import HRFlowable
except ImportError:
    try:
        from reportlab.platypus import HRFlowable
    except ImportError:
        # Fallback to custom Flowable if HRFlowable isn't exposed or reportlab namespace is restricted
        from reportlab.platypus import Flowable
        class HRFlowable(Flowable):
            def __init__(self, width="100%", thickness=1, color=colors.gray, spaceBefore=1, spaceAfter=1):
                Flowable.__init__(self)
                self.width = width
                self.thickness = thickness
                self.color = color
                self.spaceBefore = spaceBefore
                self.spaceAfter = spaceAfter
            def draw(self):
                self.canv.saveState()
                self.canv.setStrokeColor(self.color)
                self.canv.setLineWidth(self.thickness)
                self.canv.line(0, 0, 500, 0)
                self.canv.restoreState()

def generate_pdf_report(assessment, user_name="Patient"):
    """
    Generates a high-quality, professional PDF report for the diabetes assessment.
    Returns: BytesIO buffer containing the PDF binary data.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Palette
    color_primary = colors.HexColor('#0f172a')   # Deep Slate
    color_accent = colors.HexColor('#0ea5e9')    # Cyan Accent
    color_dark = colors.HexColor('#1e293b')      # Card BG
    color_text = colors.HexColor('#334155')      # Slate Charcoal
    
    # Highlight risk level coloring
    risk_level = str(assessment.get('riskLevel', 'low')).lower()
    
    # Safely parse risk percentage as an integer to avoid TypeError or missing field exceptions
    try:
        risk_percentage = int(assessment.get('riskPercentage', 10))
    except (ValueError, TypeError):
        risk_percentage = 10
    
    # Determine Diabetes Stage precisely
    if risk_percentage >= 75:
        diabetes_stage = "High Risk"
        color_risk = colors.HexColor('#ef4444')  # Red
    elif risk_percentage >= 50:
        diabetes_stage = "Type 2 Diabetic"
        color_risk = colors.HexColor('#ef4444')  # Red
    elif risk_percentage >= 35:
        diabetes_stage = "Prediabetic"
        color_risk = colors.HexColor('#f59e0b')  # Amber
    else:
        diabetes_stage = "Non-Diabetic"
        color_risk = colors.HexColor('#10b981')  # Emerald

    # Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=color_primary,
        spaceAfter=4,
        alignment=0
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=color_accent,
        spaceAfter=12
    )
    
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=color_primary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=color_text,
        leading=13
    )
    
    bold_body_style = ParagraphStyle(
        'BoldBodyCustom',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        textColor=colors.HexColor('#64748b'),
        leading=11,
        alignment=1
    )

    story = []

    # 1. Header Block with Logo Icon Representation
    header_data = [
        [
            Paragraph("<b>DiaCare AI</b>", ParagraphStyle('LogoStyle', fontName='Helvetica-Bold', fontSize=24, textColor=color_accent)),
            Paragraph("DIABETES CLINICAL HEALTH REPORT", ParagraphStyle('HeaderRight', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#64748b'), alignment=2))
        ]
    ]
    header_table = Table(header_data, colWidths=[200, 310])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=color_accent, spaceBefore=6, spaceAfter=15))

    # 2. Patient Profile & Snapshot Table
    metrics = assessment.get('metrics', {})
    clinical = assessment.get('clinicalData', {}) or {}
    
    # Try parsing created_at to user readable format
    created_at_str = assessment.get('createdAt', 'N/A')
    formatted_date_time = created_at_str
    try:
        if created_at_str and 'N/A' not in created_at_str:
            dt = datetime.datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            formatted_date_time = dt.strftime('%B %d, %Y - %I:%M %p')
    except Exception:
        pass

    profile_data = [
        [
            Paragraph("<b>Full Name:</b>", bold_body_style), Paragraph(str(user_name), body_style),
            Paragraph("<b>Assessment Date/Time:</b>", bold_body_style), Paragraph(str(formatted_date_time), body_style)
        ],
        [
            Paragraph("<b>Age:</b>", bold_body_style), Paragraph(f"{metrics.get('age', 'N/A')} yrs", body_style),
            Paragraph("<b>Gender:</b>", bold_body_style), Paragraph(str(metrics.get('gender', 'N/A')).capitalize(), body_style)
        ],
        [
            Paragraph("<b>Height:</b>", bold_body_style), Paragraph(f"{metrics.get('height', 'N/A')} cm", body_style),
            Paragraph("<b>Weight:</b>", bold_body_style), Paragraph(f"{metrics.get('weight', 'N/A')} kg", body_style)
        ],
        [
            Paragraph("<b>Calculated BMI:</b>", bold_body_style), Paragraph(f"{metrics.get('bmi', 'N/A')} kg/m²", body_style),
            Paragraph("<b>Report ID:</b>", bold_body_style), Paragraph(str(assessment.get('assessmentId', 'N/A')).upper(), body_style)
        ]
    ]
    
    profile_table = Table(profile_data, colWidths=[100, 155, 125, 150])
    profile_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(profile_table)
    story.append(Spacer(1, 10))

    # 3. Symptoms Summary Block
    story.append(Paragraph("Reported Symptoms Checklist", section_title))
    symptoms = assessment.get('symptoms', {})
    active_symptoms = [smp_name.replace('frequentUrination', 'Frequent Urination')
                                .replace('excessiveThirst', 'Excessive Thirst')
                                .replace('extremeHunger', 'Extreme Hunger')
                                .replace('constantFatigue', 'Constant Fatigue')
                                .replace('blurredVision', 'Blurred Vision')
                                .replace('slowHealing', 'Slow Healing Wounds')
                                .replace('tinglingHandsFeet', 'Tingling Extremities')
                                .replace('frequentInfections', 'Frequent Infections')
                                .replace('dryMouth', 'Dry Mouth')
                                .replace('suddenWeightChange', 'Sudden Weight Change')
                                .replace('headaches', 'Headaches')
                                .replace('dizziness', 'Dizziness')
                       for smp_name, active in symptoms.items() if active]
    
    if active_symptoms:
        symptoms_text = ", ".join(active_symptoms)
    else:
        symptoms_text = "No symptoms selected or reported."
        
    story.append(Paragraph(symptoms_text, body_style))
    story.append(Spacer(1, 10))

    # 4. Medical Parameters Table
    story.append(Paragraph("Physiological & Lab Measurements", section_title))
    glucose_val = clinical.get('glucose', 'N/A')
    bp_val = clinical.get('bloodPressure', 'N/A')
    insulin_val = clinical.get('insulin', 'N/A')
    hba1c_val = clinical.get('hba1c', 'N/A')
    chol_val = clinical.get('cholesterol', 'N/A')
    bmi_val = metrics.get('bmi', 'N/A')
    
    # Present neatly
    med_params_data = [
        [
            Paragraph("<b>Parameter</b>", ParagraphStyle('TableH1', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white)),
            Paragraph("<b>Recorded Level</b>", ParagraphStyle('TableH2', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1)),
            Paragraph("<b>Normal Reference Range</b>", ParagraphStyle('TableH3', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1)),
            Paragraph("<b>Status Assessment</b>", ParagraphStyle('TableH4', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1))
        ],
        [
            Paragraph("Fasting Plasma Glucose", body_style),
            Paragraph(f"{glucose_val} mg/dL" if glucose_val != 'N/A' else "Not provided", ParagraphStyle('C1', parent=body_style, alignment=1)),
            Paragraph("70 – 100 mg/dL", ParagraphStyle('C2', parent=body_style, alignment=1)),
            Paragraph("Normal" if (isinstance(glucose_val, (int, float)) and glucose_val < 100) else "Elevated (Prediabetic)" if (isinstance(glucose_val, (int, float)) and glucose_val < 126) else "High (Diabetic Indicator)" if isinstance(glucose_val, (int, float)) else "Uncalibrated", ParagraphStyle('C3', parent=body_style, alignment=1, textColor=colors.HexColor('#ef4444') if (isinstance(glucose_val, (int, float)) and glucose_val >= 126) else colors.HexColor('#f59e0b') if (isinstance(glucose_val, (int, float)) and glucose_val >= 100) else color_text))
        ],
        [
            Paragraph("Blood Pressure (Systolic)", body_style),
            Paragraph(f"{bp_val} mmHg" if bp_val != 'N/A' else "Not provided", ParagraphStyle('C1', parent=body_style, alignment=1)),
            Paragraph("&lt; 120 mmHg", ParagraphStyle('C2', parent=body_style, alignment=1)),
            Paragraph("Normal" if (isinstance(bp_val, (int, float)) and bp_val < 120) else "Prehypertension" if (isinstance(bp_val, (int, float)) and bp_val < 140) else "Stage 1/2 Hypertension" if isinstance(bp_val, (int, float)) else "Uncalibrated", ParagraphStyle('C3', parent=body_style, alignment=1))
        ],
        [
            Paragraph("HbA1c Meter Score", body_style),
            Paragraph(f"{hba1c_val} %" if hba1c_val != 'N/A' else "Not provided", ParagraphStyle('C1', parent=body_style, alignment=1)),
            Paragraph("&lt; 5.7 %", ParagraphStyle('C2', parent=body_style, alignment=1)),
            Paragraph("Normal" if (isinstance(hba1c_val, (int, float)) and hba1c_val < 5.7) else "Prediabetes" if (isinstance(hba1c_val, (int, float)) and hba1c_val < 6.5) else "Type 2 Diabetes" if isinstance(hba1c_val, (int, float)) else "Uncalibrated", ParagraphStyle('C3', parent=body_style, alignment=1))
        ],
        [
            Paragraph("Plasma Insulin Level", body_style),
            Paragraph(f"{insulin_val} uIU/mL" if insulin_val != 'N/A' else "Not provided", ParagraphStyle('C1', parent=body_style, alignment=1)),
            Paragraph("2.6 – 24.9 uIU/mL", ParagraphStyle('C2', parent=body_style, alignment=1)),
            Paragraph("Normal" if (isinstance(insulin_val, (int, float)) and insulin_val < 25) else "Elevated (Insulin Resistance)" if isinstance(insulin_val, (int, float)) else "Uncalibrated", ParagraphStyle('C3', parent=body_style, alignment=1))
        ],
        [
            Paragraph("Total Serum Cholesterol", body_style),
            Paragraph(f"{chol_val} mg/dL" if chol_val != 'N/A' else "Not provided", ParagraphStyle('C1', parent=body_style, alignment=1)),
            Paragraph("&lt; 200 mg/dL", ParagraphStyle('C2', parent=body_style, alignment=1)),
            Paragraph("Normal" if (isinstance(chol_val, (int, float)) and chol_val < 200) else "Borderline High" if (isinstance(chol_val, (int, float)) and chol_val < 240) else "High Risk" if isinstance(chol_val, (int, float)) else "Uncalibrated", ParagraphStyle('C3', parent=body_style, alignment=1))
        ],
        [
            Paragraph("Body Mass Index (BMI)", body_style),
            Paragraph(f"{bmi_val} kg/m²" if bmi_val != 'N/A' else "Not provided", ParagraphStyle('C1', parent=body_style, alignment=1)),
            Paragraph("18.5 – 24.9 kg/m²", ParagraphStyle('C2', parent=body_style, alignment=1)),
            Paragraph("Healthy Weight" if (isinstance(bmi_val, (int, float)) and bmi_val < 25) else "Overweight" if (isinstance(bmi_val, (int, float)) and bmi_val < 30) else "Obese Range" if isinstance(bmi_val, (int, float)) else "N/A", ParagraphStyle('C3', parent=body_style, alignment=1))
        ]
    ]
    
    med_params_table = Table(med_params_data, colWidths=[170, 110, 120, 110])
    med_params_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), color_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
    ]))
    
    story.append(med_params_table)
    story.append(Spacer(1, 12))

    # 5. Prediction Results & Stage Box
    story.append(Paragraph("Risk Assessment Predictions", section_title))
    
    results_headers = [
        [
            Paragraph("<b>DIABETES PROBABILITY</b>", ParagraphStyle('H1_Card', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1)),
            Paragraph("<b>DIABETES CLINICAL STAGE</b>", ParagraphStyle('H2_Card', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1)),
            Paragraph("<b>GENERAL HEALTH SCORE</b>", ParagraphStyle('H3_Card', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1))
        ],
        [
            Paragraph(f"<font size=16 color='{color_risk.hexval()}'><b>{risk_percentage}%</b></font>", ParagraphStyle('R1', alignment=1)),
            Paragraph(f"<font size=14 color='{color_risk.hexval()}'><b>{diabetes_stage.upper()}</b></font>", ParagraphStyle('R2', alignment=1)),
            Paragraph(f"<font size=16 color='#10b981'><b>{assessment.get('healthScore', 90)}/100</b></font>", ParagraphStyle('R3', alignment=1))
        ]
    ]
    
    results_table = Table(results_headers, colWidths=[175, 160, 175])
    results_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), color_dark),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
    ]))
    story.append(results_table)
    story.append(Spacer(1, 10))

    # 6. Risk Meter Visualization (ReportLab Drawing)
    story.append(Paragraph("Risk Meter Visualization", section_title))
    meter = Drawing(510, 40)
    # Background bar with low, moderate, high colored sections
    meter.add(Rect(0, 15, 510, 12, fillColor=colors.HexColor('#e2e8f0'), strokeColor=None, rx=5, ry=5))
    # Draw Emerald for low risk (0 to 35%) -> width 178
    meter.add(Rect(0, 15, 178, 12, fillColor=colors.HexColor('#10b981'), strokeColor=None, rx=5, ry=5))
    # Draw Amber for moderate risk (35% to 75%) -> width 204 starting at 178
    meter.add(Rect(178, 15, 204, 12, fillColor=colors.HexColor('#f59e0b'), strokeColor=None))
    # Draw Red for high risk (74% to 100%) -> width 128 starting at 382
    meter.add(Rect(382, 15, 128, 12, fillColor=colors.HexColor('#ef4444'), strokeColor=None, rx=5, ry=5))
    
    # Text labels below bar
    meter.add(DString(5, 3, "LOW RISK (0-35%)", fontSize=7, fontName="Helvetica-Bold", fillColor=colors.HexColor('#64748b')))
    meter.add(DString(220, 3, "MODERATE RISK (35-75%)", fontSize=7, fontName="Helvetica-Bold", fillColor=colors.HexColor('#64748b')))
    meter.add(DString(415, 3, "HIGH RISK (75-100%)", fontSize=7, fontName="Helvetica-Bold", fillColor=colors.HexColor('#64748b')))
    
    # Map index to width
    pos = 510 * (risk_percentage / 100.0)
    pos = max(5, min(505, pos))
    
    # Cursor
    meter.add(Circle(pos, 21, 6, fillColor=colors.HexColor('#0f172a'), strokeColor=colors.white, strokeWidth=1.5))
    story.append(meter)
    story.append(Spacer(1, 12))

    # 7. AI Health Assessment Summary
    story.append(Paragraph("AI Clinical Remarks & Observations", section_title))
    explanation = assessment.get('explanation', 'Diabetes health assessment screening complete.')
    story.append(Paragraph(explanation, body_style))
    story.append(Spacer(1, 10))

    # 8. Personalized Recommendations Block
    story.append(Paragraph("Personalized Diagnostic & Lifestyle Guidelines", section_title))
    recs = assessment.get('recommendations', [])
    
    # Filter/Ensure we have appropriate advice listed as requested
    diet_recs = [r for r in recs if 'diet' in r.lower() or 'carb' in r.lower() or 'sugar' in r.lower() or 'आहार' in r or 'अन्न' in r]
    exercise_recs = [r for r in recs if 'exercise' in r.lower() or 'walk' in r.lower() or 'active' in r.lower() or 'व्यायाम' in r or 'चालणे' in r]
    water_recs = [r for r in recs if 'water' in r.lower() or 'hydration' in r.lower() or 'द्रव' in r.lower() or 'पाणी' in r or 'जल' in r]
    test_recs = [r for r in recs if 'test' in r.lower() or 'screen' in r.lower() or 'hba1c' in r.lower() or 'gucos' in r.lower() or 'चाचणी' in r or 'परीक्षण' in r]
    
    # Fallback/fill if sparse to make report extremely rich
    if not diet_recs:
        diet_recs = ["Diet Advice: Restrict glycemic load, eliminate artificial sweeteners, refine carb consumption with high dietary fibers, and consult a dietitian."]
    if not exercise_recs:
        exercise_recs = ["Physical Activity Plan: Execute 30+ minutes of brisk aerobic walking, jogging, or cardiovascular exercises 5 times a week."]
    if not water_recs:
        water_recs = ["Hydration Target: Drink at least 2.5 to 3 liters of fresh water daily to reduce blood sugar hyper-concentration spikes."]
    
    # Output them itemized/described clearly
    all_compiled_recs = []
    all_compiled_recs.extend(diet_recs)
    all_compiled_recs.extend(exercise_recs)
    all_compiled_recs.extend(water_recs)
    
    # Add other general recommendations not caught yet
    remaining = [r for r in recs if r not in diet_recs and r not in exercise_recs and r not in water_recs and r not in test_recs]
    all_compiled_recs.extend(remaining)
    
    if test_recs:
        all_compiled_recs.extend(test_recs)
    else:
        # Suggested diagnostics
        all_compiled_recs.append("Suggested Medical Diagnostics: Fasting Blood sugar tests, HbA1c average assessments, lipid profiling, and physical endocrinological evaluations.")
        
    for rec in all_compiled_recs:
        story.append(Paragraph(f"• {rec}", body_style))
        story.append(Spacer(1, 3.5))
    
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceBefore=0, spaceAfter=15))

    # 9. Disclaimer
    disclaimer_text = (
        "<b>Medical Disclaimer:</b> This assessment is intended for health awareness only and is not "
        "a replacement for professional medical diagnosis. Decisions regarding medical therapy, insulin "
        "titration, or diagnostic clinical tests must be formulated inside direct clinical consults with "
        "registered human endocrinologists or standard laboratory screenings."
    )
    story.append(Paragraph(disclaimer_text, disclaimer_style))
    story.append(Spacer(1, 10))
    
    # 10. Footer line
    footer_text = "<font color='#64748b' size=8>Generated by <b>DiaCare AI</b></font>"
    story.append(Paragraph(footer_text, ParagraphStyle('FooterStyle', alignment=1)))

    # Build document
    doc.build(story)
    buffer.seek(0)
    return buffer
