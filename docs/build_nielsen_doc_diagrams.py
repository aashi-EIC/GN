from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
NAVY = '#102238'; INK = '#132B46'; WHITE = '#FFFFFF'; PALE = '#F4F8FC'
PINK = '#B96C78'; CYAN = '#83AEB8'; TEAL = '#558D87'; BLUE = '#6483AD'; ORANGE = '#B88767'; PURPLE = '#887DA6'
MUTED = '#BBD0DF'; BORDER = '#D7E3ED'
FONT = 'C:/Windows/Fonts/calibri.ttf'; BOLD = 'C:/Windows/Fonts/calibrib.ttf'

def f(sz, bold=False): return ImageFont.truetype(BOLD if bold else FONT, sz)
def text(d, xy, s, size=30, fill=INK, bold=False, anchor=None): d.text(xy, s, font=f(size,bold), fill=fill, anchor=anchor)
def panel(d, box, fill, outline=None, radius=24, width=3): d.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)
def arrow(d, a, b, color=CYAN, width=7):
    d.line([a,b], fill=color, width=width, joint='curve')
    x1,y1=a; x2,y2=b
    import math
    th=math.atan2(y2-y1,x2-x1); ln=22; w=11
    p=[(x2,y2),(x2-ln*math.cos(th)+w*math.sin(th),y2-ln*math.sin(th)-w*math.cos(th)),(x2-ln*math.cos(th)-w*math.sin(th),y2-ln*math.sin(th)+w*math.cos(th))]
    d.polygon(p,fill=color)
def base(kicker,title,subtitle):
    im=Image.new('RGB',(1800,1020),NAVY); d=ImageDraw.Draw(im)
    panel(d,(34,32,1766,988),'#0B2039','#274664',30,3)
    text(d,(82,78),kicker.upper(),24,CYAN,True)
    text(d,(82,117),title,52,WHITE,True)
    text(d,(83,185),subtitle,28,MUTED)
    d.line((82,225,1718,225),fill='#29465F',width=3)
    return im,d
def save(im,name): im.save(OUT/name,optimize=True)

im,d=base('Figure 1  |  solution architecture','From business question to governed data','Five responsibilities, one connected experience')
cards=[
 ('01','React UI','Question + model\nAnswer + visualization',PINK),
 ('02','Node.js BFF','Validate + map\nSession + adaptation',BLUE),
 ('03','MCP Host','Conversation + tools\nAnswer composition',TEAL),
 ('04','MCP Server','Model-aware DAX\nQuery execution',ORANGE),
 ('05','Power BI / Fabric','Semantic models\nMeasures + results',PURPLE),
]
for i,(num,title,desc,col) in enumerate(cards):
    x=82+i*331; panel(d,(x,300,x+290,635),'#15314B','#42627B',24,3)
    panel(d,(x+22,321,x+80,379),col,None,16,0); text(d,(x+51,350),num,25,WHITE,True,'mm')
    text(d,(x+22,408),title,35,WHITE,True)
    for j,line in enumerate(desc.split('\n')): text(d,(x+22,474+j*38),line,24,MUTED)
    if i<4: arrow(d,(x+294,465),(x+324,465),CYAN,6)
panel(d,(82,701,1718,911),'#102C45','#365876',22,3)
text(d,(116,733),'CONTROL PLANE',25,CYAN,True)
for i,(a,b) in enumerate([('Identity','Verified user context'),('Model policy','Approved IDs + access'),('Telemetry','Correlated request trace'),('Secrets','Server-side credentials')]):
    x=116+i*396
    d.ellipse((x,796,x+20,816),fill=[PINK,BLUE,TEAL,ORANGE][i])
    text(d,(x+32,788),a,29,WHITE,True); text(d,(x+32,832),b,24,MUTED)
save(im,'nielsen_doc_architecture.png')

im,d=base('Figure 2  |  end-to-end flow','One question, a traceable answer','Forward request and evidence-bearing return')
lanes=[('USER',PINK),('UI + BFF',BLUE),('MCP HOST',TEAL),('MCP SERVER',ORANGE),('FABRIC',PURPLE)]
xs=[147,506,869,1232,1591]
for (label,col),x in zip(lanes,xs):
    panel(d,(x-105,262,x+105,319),col,None,16,0); text(d,(x,291),label,25,WHITE,True,'mm')
    d.line((x,326,x,879),fill='#42627B',width=3)
steps=[(0,1,365,'Question + model'),(1,2,431,'Validated chat request'),(2,3,497,'Tool call / context'),(3,4,563,'Execute generated DAX'),(4,3,629,'Rows + query metadata'),(3,2,695,'Structured tool result'),(2,1,761,'Answer + MCP session'),(1,0,827,'Readable answer + chart')]
for i,(a,b,y,label) in enumerate(steps):
    col=CYAN if b>a else '#F79BBE'
    arrow(d,(xs[a]+(18 if b>a else -18),y),(xs[b]-(18 if b>a else -18),y),col,5)
    text(d,((xs[a]+xs[b])//2,y-35),f'{i+1:02}  {label}',23,WHITE,True,'mm')
save(im,'nielsen_doc_sequence.png')

im,d=base('Figure 3  |  api integration','Contracts stay at their boundary','The browser does not own Fabric credentials or upstream payload quirks')
nodes=[
 (82,303,545,671,'BROWSER / REACT',PINK,['Question + selected model','Conversation ID','Rendered answer / chart']),
 (668,303,1131,671,'NODE.JS BFF',BLUE,['Request validation + limits','Model ID mapping','Response normalization']),
 (1254,303,1718,671,'MCP HOST + SERVER',TEAL,['Session + tool orchestration','DAX generation / execution','Structured query result']),
]
for x1,y1,x2,y2,title,col,lines in nodes:
    panel(d,(x1,y1,x2,y2),'#15314B','#41617C',24,3)
    d.rectangle((x1,y1,x2,y1+12),fill=col)
    text(d,(x1+30,y1+54),title,31,WHITE,True)
    for i,s in enumerate(lines):
        yy=y1+151+i*62; d.ellipse((x1+32,yy+7,x1+46,yy+21),fill=col)
        text(d,(x1+62,yy),s,27,MUTED)
arrow(d,(550,482),(663,482),CYAN,8); arrow(d,(1137,482),(1249,482),CYAN,8)
panel(d,(82,739,1718,906),'#0F2C46','#365876',22,3)
text(d,(114,772),'SERVER-CONTROLLED CONTEXT',25,CYAN,True)
text(d,(114,817),'Approved catalogue  •  credentials  •  timeouts  •  correlation ID  •  diagnostics policy',30,WHITE)
save(im,'nielsen_doc_contracts.png')

im,d=base('Figure 4  |  Entra authentication','Two API audiences, one verified user','BFF validation and on-behalf-of exchange precede model authorization')
cols=[
 ('01','USER','Entra sign-in',PINK),
 ('02','BFF API','Validate user token',BLUE),
 ('03','OBO','Exchange for Host',ORANGE),
 ('04','MCP HOST','Authorize model',TEAL),
 ('05','FABRIC','Execute query',PURPLE),
]
for i,(num,title,detail,col) in enumerate(cols):
    x=82+i*331
    panel(d,(x,332,x+290,674),'#17364E','#55738C',23,3)
    panel(d,(x+24,356,x+87,419),col,None,17,0)
    text(d,(x+55,387),num,25,WHITE,True,'mm')
    text(d,(x+23,465),title,30,WHITE,True)
    text(d,(x+23,528),detail,23,MUTED)
    if i<4: arrow(d,(x+294,501),(x+324,501),CYAN,5)
panel(d,(82,754,1718,914),'#142F49','#42647F',20,3)
text(d,(113,789),'TOKEN BOUNDARIES',25,CYAN,True)
text(d,(113,832),'BFF audience  •  MCP Host audience  •  separate Power BI execution identity',28,WHITE)
text(d,(113,871),'Session IDs preserve conversation state; they do not replace authorization.',24,MUTED)
save(im,'nielsen_doc_security.png')

im,d=base('Figure 5  |  deployment topology','Independent tiers, controlled routing','Same-origin web access with analytical services behind the application edge')
panel(d,(82,296,1718,697),'#132E49','#416582',24,3)
text(d,(114,329),'APPLICATION NETWORK',25,CYAN,True)
for x,title,detail,col in [
    (115,'INGRESS','/api  |  web routes',BLUE),
    (522,'REACT UI','Static application',PINK),
    (929,'NODE.JS BFF','API + adapters',TEAL),
    (1336,'MCP HOST','Conversation',ORANGE),
]:
    panel(d,(x,413,x+337,605),'#1A3954','#58758D',18,3)
    d.rectangle((x,413,x+337,423),fill=col)
    text(d,(x+22,463),title,31,WHITE,True)
    text(d,(x+22,526),detail,26,MUTED)
for a,b in [(452,512),(859,919),(1266,1326)]:arrow(d,(a,506),(b,506),CYAN,6)
panel(d,(82,755,850,918),'#17364E','#416582',18,3)
panel(d,(950,755,1718,918),'#17364E','#416582',18,3)
text(d,(115,791),'MCP SERVER',31,WHITE,True); text(d,(115,844),'DAX query tool + Power BI connection',26,MUTED)
text(d,(983,791),'FABRIC + BEDROCK',31,WHITE,True); text(d,(983,844),'Governed data + model inference',26,MUTED)
d.line((1500,697,1500,720,450,720),fill=CYAN,width=5)
arrow(d,(450,720),(450,747),CYAN,5)
arrow(d,(852,836),(940,836),CYAN,5)
save(im,'nielsen_doc_deployment.png')

im,d=base('Figure 6  |  model onboarding','New models enter through a governed path','Publish, map, validate, release and monitor without surprising users')
stages=[
 ('01','DISCOVER','Fabric model + metadata',BLUE),
 ('02','APPROVE','Business scope + access',TEAL),
 ('03','MAP','UI, BFF and Host IDs',ORANGE),
 ('04','VALIDATE','Representative questions',PINK),
 ('05','PUBLISH','Picker + documentation',PURPLE),
]
for i,(num,title,detail,col) in enumerate(stages):
    x=82+i*331
    panel(d,(x,340,x+290,679),'#17364E','#55738C',23,3)
    panel(d,(x+25,364,x+89,428),col,None,17,0)
    text(d,(x+57,396),num,26,WHITE,True,'mm')
    text(d,(x+24,465),title,31,WHITE,True)
    text(d,(x+24,529),detail,23,MUTED)
    if i<4: arrow(d,(x+295,503),(x+323,503),CYAN,5)
panel(d,(82,754,1718,921),'#142F49','#42647F',20,3)
text(d,(113,792),'OPERATIONAL LOOP',25,CYAN,True)
text(d,(113,839),'Observe quality and latency  •  update catalogue  •  re-test mappings  •  roll back safely',27,WHITE)
save(im,'nielsen_doc_model_onboarding.png')

print('Created 6 diagrams in', OUT)
