from __future__ import annotations

from pathlib import Path
from math import sin, pi
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

HERE = Path(__file__).resolve().parent
OUT = HERE / "Nielsen_Conversational_BI_Case_Study_Expanded.pdf"
ART = HERE / "case_study_cover.png"
pdfmetrics.registerFont(TTFont("Calibri", "C:/Windows/Fonts/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", "C:/Windows/Fonts/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Light", "C:/Windows/Fonts/calibril.ttf"))

W, H = A4
NAVY = HexColor("#07172D")
INK = HexColor("#142742")
MUTED = HexColor("#52677F")
PINK = HexColor("#F70B61")
CYAN = HexColor("#18B9D5")
TEAL = HexColor("#0B8B83")
LIME = HexColor("#C7F2E9")
PALE = HexColor("#F2F6FA")
LINE = HexColor("#D8E3EC")
WHITE = HexColor("#FFFFFF")
BLUE = HexColor("#2B66C7")
ORANGE = HexColor("#ED8D4A")

c = canvas.Canvas(str(OUT), pagesize=A4)
c.setTitle("Nielsen Conversational BI | Solution Engineering Case Study")
c.setAuthor("Conversational BI Solution Team")
c.setSubject("Client-facing showcase of conversational analytics application and architecture")

def txt(x, y, s, size=10, color=INK, font="Calibri", align="left"):
    c.setFont(font, size); c.setFillColor(color)
    {"left": c.drawString, "right": c.drawRightString, "center": c.drawCentredString}[align](x, y, s)

def fit(s, max_width, size=10, font="Calibri"):
    words = str(s).split(); lines=[]; cur=""
    for word in words:
        cand = (cur + " " + word).strip()
        if pdfmetrics.stringWidth(cand, font, size) <= max_width: cur=cand
        else:
            if cur: lines.append(cur)
            cur=word
    if cur: lines.append(cur)
    return lines

def para(x, y, s, width, size=10, leading=14, color=MUTED, font="Calibri", max_lines=None):
    lines=fit(s,width,size,font)
    if max_lines: lines=lines[:max_lines]
    for line in lines: txt(x,y,line,size,color,font); y-=leading
    return y

def rr(x,y,w,h,fill=WHITE,stroke=LINE,r=14,sw=1):
    c.setLineWidth(sw); c.setFillColor(fill); c.setStrokeColor(stroke if stroke else fill)
    c.roundRect(x,y,w,h,r,fill=1,stroke=bool(stroke))

def line(x1,y1,x2,y2,col=LINE,width=1):
    c.setStrokeColor(col); c.setLineWidth(width); c.line(x1,y1,x2,y2)

def pill(x,y,label,fill=PALE,col=INK,size=8,pad=9):
    width=pdfmetrics.stringWidth(label,"Calibri-Bold",size)+2*pad
    rr(x,y,width,20,fill,None,10)
    txt(x+pad,y+6,label,size,col,"Calibri-Bold")
    return width

def arrow(x1,y1,x2,y2,col=CYAN,width=2):
    line(x1,y1,x2,y2,col,width)
    ang=__import__("math").atan2(y2-y1,x2-x1)
    a=8; b=4
    p=c.beginPath(); p.moveTo(x2,y2)
    p.lineTo(x2-a*__import__("math").cos(ang)+b*__import__("math").sin(ang),y2-a*__import__("math").sin(ang)-b*__import__("math").cos(ang))
    p.lineTo(x2-a*__import__("math").cos(ang)-b*__import__("math").sin(ang),y2-a*__import__("math").sin(ang)+b*__import__("math").cos(ang))
    p.close(); c.setFillColor(col); c.drawPath(p,stroke=0,fill=1)

def circle_num(x,y,n,fill=PINK):
    c.setFillColor(fill); c.circle(x,y,12,fill=1,stroke=0)
    txt(x,y-3,str(n),9,WHITE,"Calibri-Bold","center")

def header(kicker,title,sub,page):
    c.setFillColor(WHITE); c.rect(0,0,W,H,stroke=0,fill=1)
    c.setFillColor(NAVY); c.rect(0,H-7,W,7,stroke=0,fill=1)
    txt(34,H-42,"NIELSEN  /  CONVERSATIONAL BI",8,PINK,"Calibri-Bold")
    txt(W-34,H-42,f"{page:02d}  /  12",8,MUTED,"Calibri-Bold","right")
    txt(34,H-77,kicker.upper(),9,TEAL,"Calibri-Bold")
    txt(34,H-113,title,25,INK,"Calibri-Bold")
    para(34,H-138,sub,W-68,10.5,15,MUTED)
    line(34,42,W-34,42,LINE,.7)
    txt(34,27,"SOLUTION ENGINEERING CASE STUDY",7.5,MUTED,"Calibri-Bold")
    txt(W-34,27,"CLIENT SHOWCASE  •  OCT 2026",7.5,MUTED,"Calibri-Bold","right")

def card(x,y,w,h,label,title,body,accent=TEAL):
    rr(x,y,w,h,WHITE,LINE,12)
    c.setFillColor(accent); c.roundRect(x+14,y+h-32,4,17,2,fill=1,stroke=0)
    txt(x+26,y+h-25,label.upper(),8,accent,"Calibri-Bold")
    txt(x+16,y+h-58,title,14,INK,"Calibri-Bold")
    para(x+16,y+h-80,body,w-32,9.5,13,MUTED)

def page(): c.showPage()

c.drawImage(ImageReader(str(ART)),0,0,width=W,height=H,mask="auto")
c.setFillColor(Color(0.018,0.055,0.11,alpha=.28)); c.rect(0,0,W,H,fill=1,stroke=0)
txt(38,H-68,"NIELSEN  /  SOLUTION ENGINEERING",10,HexColor("#D1EBF2"),"Calibri-Bold")
line(38,H-79,187,H-79,PINK,2.4)
txt(38,H-170,"Conversational",35,WHITE,"Calibri-Light")
txt(38,H-213,"Business Intelligence",35,WHITE,"Calibri-Bold")
para(40,H-253,"A practical conversational layer over enterprise semantic models - designed to turn natural-language questions into grounded analytics.",285,13,19,HexColor("#D4E9F4"))
rr(38,84,327,105,Color(.03,.08,.16,alpha=.78),HexColor("#4B6881"),16)
txt(56,160,"THE WORK",9,HexColor("#86DDE7"),"Calibri-Bold")
para(56,140,"React experience  •  Node.js BFF  •  MCP integration  •  DAX-backed Power BI analysis",291,10.5,15,WHITE)
txt(38,39,"PROJECT SHOWCASE  /  OCTOBER 2026",9,HexColor("#C7D9E6"),"Calibri-Bold")
page()

header("01 / opportunity","From questions to decisions","A single analytics experience designed around how business users actually ask for information.",2)
rr(34,498,W-68,174,NAVY,None,19)
txt(56,641,"THE CHALLENGE",9,HexColor("#8BD6E5"),"Calibri-Bold")
para(56,616,"Power BI semantic models contain trusted metrics, but a user still needs to know where to look, which model to choose, and how to translate a business question into a useful report.",W-112,15,21,WHITE)
txt(56,539,"OUR RESPONSE",9,HexColor("#FF8FB7"),"Calibri-Bold")
para(56,520,"A chat workspace keeps the semantic model explicit and uses the existing MCP-backed analytics service.",W-112,11,16,WHITE)
card(34,313,164,157,"Experience","Ask naturally","Guided model selection, conversational answers, charts, tables, and export in one workspace.",PINK)
card(215,313,164,157,"Integration","Reuse the pipeline","A BFF validates and adapts requests while the MCP Host and Server perform analytics.",BLUE)
card(396,313,164,157,"Control","Make it governable","Clear boundaries for model access, identity, operational telemetry, and future hardening.",TEAL)
txt(34,280,"WHAT THIS SHOWCASE COVERS",9,TEAL,"Calibri-Bold")
items=["A polished user journey from question to evidence-backed answer","The application architecture and the client-side integration points","Current implementation plus a credible path to enterprise operations"]
for i,s in enumerate(items):
    circle_num(46,248-i*31,i+1,PINK if i==0 else BLUE)
    txt(67,244-i*31,s,10.5,INK)
rr(34,78,W-68,62,PALE,None,12)
txt(50,115,"THE DESIGN IN ONE LINE",8,TEAL,"Calibri-Bold")
txt(50,96,"A focused BI experience that connects questions to governed analytical evidence.",10,INK,"Calibri-Bold")
page()

header("02 / experience","One workspace, one question","The interface reduces the distance between a business prompt and a usable analytical result.",3)
rr(34,199,W-68,461,HexColor("#F7FAFD"),LINE,18)
rr(47,610,W-94,38,NAVY,None,10)
txt(63,623,"Conversational BI",11,WHITE,"Calibri-Bold")
pill(422,619,"Workspace",HexColor("#263C54"),WHITE,8)
rr(47,555,166,43,WHITE,LINE,8)
txt(59,581,"SEMANTIC MODEL",7.4,MUTED,"Calibri-Bold")
txt(59,564,"Schedule Completeness TSG  ▾",9.5,INK,"Calibri-Bold")
rr(226,555,322,43,WHITE,LINE,8)
txt(241,573,"What was the completeness trend in Q1?",10,INK)
c.setFillColor(PINK); c.circle(529,576,12,fill=1,stroke=0); txt(529,572,">",13,WHITE,"Calibri-Bold","center")
rr(47,454,501,87,HexColor("#EAF2FC"),None,10)
txt(62,519,"YOU ASKED",8,BLUE,"Calibri-Bold")
para(62,498,"Which customers had the biggest improvement, and what changed month to month?",467,11,16,INK)
rr(47,242,501,196,WHITE,LINE,11)
txt(62,412,"ANALYSIS",8,TEAL,"Calibri-Bold")
para(62,391,"The response combines a concise explanation with a structured result that can be reviewed or exported.",448,10,14,MUTED)
line(62,360,532,360,LINE,.8)
for i,(name,a,b,delta) in enumerate([("Customer A","76%","91%","+15 pts"),("Customer B","83%","94%","+11 pts"),("Customer C","88%","96%","+8 pts")]):
    y=338-i*27
    if i%2==0: c.setFillColor(PALE); c.rect(62,y-9,470,24,fill=1,stroke=0)
    txt(71,y,name,9,INK,"Calibri-Bold"); txt(281,y,a,9,MUTED); txt(361,y,b,9,MUTED); txt(456,y,delta,9,TEAL,"Calibri-Bold")
txt(66,260,"Illustrative content - not production data",7.5,MUTED)
txt(34,174,"FOUR MOMENTS THAT MATTER",9,TEAL,"Calibri-Bold")
for i,(h,d) in enumerate([("Choose","Select trusted data"),("Ask","Use business language"),("Review","Read chart + table"),("Act","Export and share")]):
    x=34+i*135; circle_num(x+11,140,i+1, [PINK,BLUE,TEAL,ORANGE][i]); txt(x+30,143,h,10,INK,"Calibri-Bold"); txt(x+30,127,d,8.5,MUTED)
page()

header("03 / architecture","A composable analytics stack","The UI and BFF add a business-friendly experience without replacing the existing analytical execution path.",4)
bands=[
 ("01  EXPERIENCE","React UI","Chat, model picker, results, charts, export",PINK),
 ("02  APPLICATION EDGE","Node.js BFF","Request validation, session handoff, adaptation",BLUE),
 ("03  ORCHESTRATION","MCP Host","Conversation context and tool orchestration",TEAL),
 ("04  ANALYTICAL GATEWAY","MCP Server","DAX generation and query-tool execution",ORANGE),
 ("05  TRUSTED DATA","Power BI / Fabric","Semantic model and governed metrics",HexColor("#8B5CCB")),
]
for i,(k,t,d,col) in enumerate(bands):
    y=570-i*94
    rr(65,y,W-130,70,WHITE,LINE,11)
    c.setFillColor(col); c.roundRect(65,y,7,70,3,fill=1,stroke=0)
    pill(82,y+39,k,PALE,col,7.8)
    txt(82,y+19,t,15,INK,"Calibri-Bold")
    txt(W-82,y+24,d,9,MUTED,align="right")
    if i<4: arrow(W/2,y-4,W/2,y-20,HexColor("#8FA9BD"),1.5)
rr(65,105,W-130,65,NAVY,None,11)
txt(83,145,"CROSS-CUTTING CONTROLS",8,HexColor("#91E0E7"),"Calibri-Bold")
para(83,125,"Identity boundary  •  approved model mapping  •  diagnostics  •  secure configuration",W-166,10,14,WHITE)
page()

header("04 / workflow","How an answer is produced","A request crosses defined layers, then returns as a readable result with analytical evidence.",5)
lanes=[("USER",PINK),("UI + BFF",BLUE),("MCP HOST",TEAL),("MCP SERVER",ORANGE),("FABRIC",HexColor("#8B5CCB"))]
xs=[53,162,285,412,532]
for (name,col),x in zip(lanes,xs):
    txt(x,641,name,8,col,"Calibri-Bold","center"); line(x,624,x,134,HexColor("#CAD9E4"),.7)
steps=[
 (1,0,1,598,"Question + selected model"),
 (2,1,2,550,"Validated / mapped request"),
 (3,2,3,502,"Tool call for analytical query"),
 (4,3,4,454,"Execute DAX against model"),
 (5,4,3,406,"Query rows + metadata"),
 (6,3,2,358,"Structured tool result"),
 (7,2,1,310,"Composed result and session"),
 (8,1,0,262,"Narrative, table, chart"),
]
for n,a,b,y,label in steps:
    circle_num(34,y,n,[PINK,BLUE,TEAL,ORANGE][min(n-1,3)])
    arrow(xs[a]+(8 if b>a else -8),y,xs[b]-(8 if b>a else -8),y,HexColor("#83A1B4"),1.6)
    txt((xs[a]+xs[b])/2,y+9,label,8.3,INK,"Calibri-Bold","center")
rr(34,128,W-68,84,PALE,None,12)
txt(50,187,"WHERE INTELLIGENCE IS APPLIED",8,TEAL,"Calibri-Bold")
para(50,165,"The Host coordinates the conversation and MCP tools. In the observed server code, an LLM-assisted step creates DAX before the Power BI query tool runs. This is not a direct browser-to-Fabric call.",W-100,10,14,MUTED)
page()

header("05 / model governance","The semantic model is deliberate","The selected model is a business context decision, not an accidental side effect of the prompt.",6)
rr(34,405,W-68,254,NAVY,None,16)
txt(54,629,"CURRENT MODEL JOURNEY",9,HexColor("#91E0E7"),"Calibri-Bold")
nodes=[("UI picker","Two bundled model options"),("BFF adapter","Maps UI ID to Host ID"),("Host + Server","Runs configured analytics path"),("Fabric","Returns query result")]
for i,(title,body) in enumerate(nodes):
    x=55+i*127
    rr(x,500,112,87,HexColor("#122D46"),HexColor("#31546E"),10)
    txt(x+12,559,f"0{i+1}",9,HexColor("#FF7FA9"),"Calibri-Bold")
    txt(x+12,538,title,10.5,WHITE,"Calibri-Bold")
    para(x+12,522,body,92,8.3,11,HexColor("#BFD8E5"))
    if i<3: arrow(x+114,543,x+125,543,CYAN,1.6)
para(54,466,"Today the UI defines Schedule Completeness TSG and Mapping Stats VOD. New Fabric models do not automatically appear in the picker; the catalogue and deployed execution mapping need coordinated updates.",W-108,10,14,WHITE)
txt(34,370,"WHY THIS MATTERS",9,TEAL,"Calibri-Bold")
card(34,185,248,158,"Clarity","The answer has a scope","A chosen model helps users understand which measures and dimensions underpin the result.",PINK)
card(297,185,263,158,"Governance","Mappings can be controlled","The BFF can validate an approved catalogue and translate display IDs to the Host contract.",BLUE)
rr(34,76,W-68,82,HexColor("#EAF7F5"),None,12)
txt(50,133,"EVOLUTION OPPORTUNITY",8,TEAL,"Calibri-Bold")
para(50,112,"Discover approved models through the MCP Host, cache a governed catalogue, and populate the UI from one source of truth. This is a planned improvement, not current automatic discovery.",W-100,9.5,13,INK)
page()

header("06 / outputs","Answers built for review","The result is more than generated prose: users can inspect the analytical shape and move the data onward.",7)
rr(34,263,W-68,397,WHITE,LINE,15)
rr(49,608,W-98,37,NAVY,None,8)
txt(64,622,"ANALYSIS  /  COMPLETENESS BY MONTH",9,WHITE,"Calibri-Bold")
pill(453,616,"MODEL: TSG",HexColor("#244765"),WHITE,7.5)
rr(50,443,261,148,PALE,None,10)
txt(64,566,"SUMMARY",8,TEAL,"Calibri-Bold")
para(64,543,"Completeness rose across the period. The largest movement came from the first month to the second; review the underlying rows before using the result in a decision.",230,10.3,15,INK)
txt(64,469,"Illustrative answer layout",8,MUTED)
rr(322,443,224,148,HexColor("#F3FBFA"),None,10)
txt(337,566,"TREND VISUAL",8,TEAL,"Calibri-Bold")
pts=[(341,480),(377,495),(413,490),(449,521),(485,530),(525,547)]
for y in [480,510,540]: line(341,y,529,y,HexColor("#D6E8E8"),.7)
for a,b in zip(pts,pts[1:]): line(*a,*b,TEAL,2.7)
for x,y in pts: c.setFillColor(WHITE); c.setStrokeColor(TEAL); c.circle(x,y,3,fill=1,stroke=1)
rr(50,291,496,136,WHITE,LINE,8)
txt(64,403,"STRUCTURED RESULT",8,TEAL,"Calibri-Bold")
cols=[("Month",65),("Customer",165),("Completeness",348),("Change",467)]
for s,x in cols: txt(x,379,s,8.5,MUTED,"Calibri-Bold")
line(64,369,531,369,LINE,.8)
for i,row in enumerate([("Jan","Customer A","76%","—"),("Feb","Customer A","84%","+8 pts"),("Mar","Customer A","91%","+7 pts")]):
    y=350-i*22
    if i%2==0: c.setFillColor(PALE); c.rect(61,y-7,471,20,fill=1,stroke=0)
    for s,(_,x) in zip(row,cols): txt(x,y,s,9,INK)
txt(34,228,"SHAREABLE FORMS",9,TEAL,"Calibri-Bold")
for i,(title,body,col) in enumerate([("Narrative","Plain-language explanation",PINK),("Visual","Trend and comparison views",BLUE),("Table","Rows that can be inspected",TEAL),("CSV","Portable data export",ORANGE)]):
    x=34+i*135; rr(x,110,123,98,WHITE,LINE,10)
    c.setFillColor(col); c.circle(x+18,187,5,fill=1,stroke=0)
    txt(x+12,162,title,11,INK,"Calibri-Bold")
    para(x+12,143,body,99,8.5,11,MUTED)
page()

header("07 / trust","Security is a boundary, not a label","The current no-Entra edition keeps identity limitations explicit while providing a route to a per-user enterprise design.",8)
rr(34,409,W-68,249,HexColor("#FFF7F1"),HexColor("#F3D5B5"),14)
txt(52,625,"CURRENT ACCESS BOUNDARY",9,HexColor("#A25D1C"),"Calibri-Bold")
para(52,598,"The BFF uses one shared workspace identity for reachable users. Browser UUIDs separate anonymous sessions and rate-limit buckets; they are not proof of identity or model authorization.",W-104,12,18,INK)
for i,(a,b) in enumerate([("Network edge","Protect the no-login app behind approved SSO gateway, VPN, or private network."),("Application edge","Validate request shape, apply rate limits, and keep secrets server-side."),("Analytics edge","Use configured service credentials to query the semantic model.")]):
    y=528-i*52; circle_num(55,y+3,i+1,ORANGE); txt(78,y+8,a,10,INK,"Calibri-Bold"); para(78,y-7,b,W-140,9,12,MUTED)
txt(34,374,"PRODUCTION IDENTITY PATH",9,TEAL,"Calibri-Bold")
stages=[("User sign-in","Enterprise identity"),("BFF validation","Audience + claims"),("Host authorization","Per-user/model policy"),("Power BI access","Approved execution")]
for i,(a,b) in enumerate(stages):
    x=34+i*135; rr(x,218,123,126,WHITE,LINE,10)
    c.setFillColor([PINK,BLUE,TEAL,ORANGE][i]); c.circle(x+17,322,6,fill=1,stroke=0)
    txt(x+13,286,a,10.3,INK,"Calibri-Bold")
    para(x+13,266,b,97,8.7,12,MUTED)
    if i<3: arrow(x+123,280,x+135,280,HexColor("#88A2B8"),1.3)
rr(34,82,W-68,109,NAVY,None,12)
txt(51,163,"DESIGN PRINCIPLE",8,HexColor("#93E0E7"),"Calibri-Bold")
para(51,139,"A session ID is conversation state. An authenticated identity is an authorization input. Production history and semantic-model permissions should be keyed to the latter, not retroactively inferred from the former.",W-102,10,14,WHITE)
page()

header("08 / operations","Designed to be observable","The application already has useful diagnostic seams; production operations turn them into a measurable service.",9)
rr(34,443,W-68,214,NAVY,None,15)
txt(54,628,"REQUEST TRACE",9,HexColor("#91E0E7"),"Calibri-Bold")
segments=[("Browser","question"),("BFF","request ID"),("Host","session ID"),("Server","tool result"),("Fabric","query status")]
for i,(a,b) in enumerate(segments):
    x=54+i*102
    c.setFillColor([PINK,BLUE,TEAL,ORANGE,HexColor("#9A6BD4")][i]); c.circle(x+20,563,20,fill=1,stroke=0)
    txt(x+20,559,str(i+1),12,WHITE,"Calibri-Bold","center")
    txt(x,521,a,10,WHITE,"Calibri-Bold")
    txt(x,504,b,8.5,HexColor("#B9D0DF"))
    if i<4: arrow(x+42,563,x+92,563,CYAN,1.5)
para(54,472,"Carry a correlation ID across boundaries so an operator can trace a slow or failed answer without exposing query contents in routine logs.",W-108,10,14,WHITE)
txt(34,411,"SERVICE HEALTH CHECKLIST",9,TEAL,"Calibri-Bold")
rows=[("Availability","Health/readiness checks; ingress and upstream reachability"),("Latency","End-to-end time and each call to Host, Server, and Fabric"),("Failures","Timeouts, invalid model IDs, expired sessions, query errors"),("Quality","Answer rendering, DAX normalization, table/chart integrity"),("Security","Auth events, rejected input, secret rotation, access reviews")]
for i,(a,b) in enumerate(rows):
    y=366-i*51; rr(34,y-20,W-68,42,WHITE,LINE,7)
    c.setFillColor([PINK,BLUE,TEAL,ORANGE,HexColor("#8B5CCB")][i]); c.rect(47,y-8,4,18,fill=1,stroke=0)
    txt(62,y,a,10,INK,"Calibri-Bold"); txt(177,y,b,8.9,MUTED)
txt(34,85,"Operational measures above are the target service scorecard, not claimed production results.",8.5,MUTED)
page()

header("09 / resilience","A clear path to scale","A horizontally scalable application depends on externalizing state before adding replicas.",10)
rr(34,443,W-68,214,HexColor("#EEF6FD"),None,14)
txt(51,626,"TODAY: FAST TO ITERATE",9,BLUE,"Calibri-Bold")
para(51,602,"The BFF and MCP Host retain some session and rate-limit state in process memory. This is practical for the current edition, but a restart or multiple replicas can separate a follow-up from its context.",W-102,11.5,17,INK)
rr(51,470,492,91,WHITE,LINE,10)
for i,label in enumerate(["Single app instance","In-memory state","Restart clears state"]):
    x=67+i*158; pill(x,505,label,[HexColor("#FDE4ED"),HexColor("#E9F1FC"),HexColor("#FFF0E3")][i],[PINK,BLUE,HexColor("#9B5B19")][i],8)
txt(34,407,"PRODUCTION DESIGN",9,TEAL,"Calibri-Bold")
rr(34,175,W-68,212,NAVY,None,14)
for i in range(3):
    x=61+i*111; rr(x,293,90,58,HexColor("#16334D"),HexColor("#46637A"),9)
    txt(x+45,320,f"APP {i+1}",9,WHITE,"Calibri-Bold","center")
    txt(x+45,303,"stateless pod",8,HexColor("#BDD4E2"),align="center")
    arrow(x+45,288,410,242,HexColor("#73CDD8"),1.2)
rr(389,210,143,95,HexColor("#12414A"),HexColor("#5CC0BD"),11)
txt(460,268,"SHARED STORE",10,WHITE,"Calibri-Bold","center")
para(405,248,"Sessions, history, and distributed limits",112,8.5,11,HexColor("#D2F0EE"))
txt(57,194,"Ingress + health checks + rolling releases + shared state",9,HexColor("#B7E1E6"))
rr(34,78,W-68,71,PALE,None,10)
para(50,124,"Then replicas can be scaled with demand and upgraded incrementally. Kubernetes Deployments and autoscaling are relevant patterns, but need client infrastructure and load testing before an availability claim.",W-100,9.5,13,MUTED)
page()

header("10 / lifecycle","Upgrade without losing confidence","A maintainable integration isolates contracts, configuration, and recoverable state.",11)
phases=[
 ("01","CONTRACT","Version the BFF-to-Host request and response schema; keep adapter tests for real payload shapes.",PINK),
 ("02","CONFIGURATION","Keep model mappings, endpoints, credentials, and feature flags out of the browser and source code.",BLUE),
 ("03","RELEASE","Promote tested images, run smoke tests, monitor error rates, and retain a rollback route.",TEAL),
 ("04","RECOVERY","Back up durable session/history stores and settings; verify restore, retention, and ownership.",ORANGE),
]
for i,(num,title,body,col) in enumerate(phases):
    y=542-i*112; rr(34,y,W-68,91,WHITE,LINE,12)
    c.setFillColor(col); c.circle(64,y+46,19,fill=1,stroke=0)
    txt(64,y+42,num,9,WHITE,"Calibri-Bold","center")
    txt(96,y+61,title,9,col,"Calibri-Bold")
    para(96,y+41,body,W-144,10,14,MUTED)
    if i<3: arrow(64,y-2,64,y-18,HexColor("#A1B7C7"),1.4)
rr(34,82,W-68,88,NAVY,None,11)
txt(51,142,"PRACTICAL RECOVERY TARGET",8,HexColor("#92E2E9"),"Calibri-Bold")
para(51,119,"Back up what must survive a restart; rehearse restore; document who approves a model or endpoint change. The current process-local stores are not a durable backup solution.",W-102,9.8,13.5,WHITE)
page()

header("11 / reuse","A foundation for the next engagement","The reusable pattern is the separation of experience, orchestration, and governed analytics.",12)
for i,(num,title,body,col) in enumerate([
 ("01","Experience layer","Adapt the chat, model selection, visual response, and guidance to a new business domain.",PINK),
 ("02","Integration layer","Reuse the BFF contract and response adaptation against approved MCP-backed services.",BLUE),
 ("03","Governance layer","Introduce client identity, model policy, telemetry, and operational runbooks at defined seams.",TEAL),
]):
    y=521-i*126; rr(34,y,W-68,108,WHITE,LINE,13)
    c.setFillColor(col); c.roundRect(34,y,8,108,3,fill=1,stroke=0)
    txt(55,y+73,num,19,col,"Calibri-Bold"); txt(110,y+76,title,14,INK,"Calibri-Bold")
    para(110,y+51,body,W-164,10,14,MUTED)
rr(34,94,W-68,70,NAVY,None,11)
txt(51,139,"TAKEAWAY",8,HexColor("#8FDEE7"),"Calibri-Bold")
para(51,117,"An understandable BI interface can sit over an established analytics stack - with integration boundaries that support future security and scale.",W-102,10.2,14,WHITE)
txt(34,77,"Selected technical references",7.7,MUTED,"Calibri-Bold")
links=[
 ("Model Context Protocol", "https://modelcontextprotocol.io/docs/learn/architecture"),
 ("Power BI semantic models", "https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand"),
 ("AWS Bedrock Claude", "https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html"),
]
x=34
for label,url in links:
    width=pdfmetrics.stringWidth(label,"Calibri",7.5)
    txt(x,57,label,7.5,BLUE)
    c.linkURL(url,(x,54,x+width,67),relative=0)
    x+=width+18
page()

c.save()
print(OUT)
