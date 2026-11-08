import re,sys
from html.parser import HTMLParser
ROUTES={'lg-home':'/','index':'/mobile','profile':'/profile','message':'/messages','notification':'/notifications','conversation':'/messages/chat'}
VOID={'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}
NOSPACE={'table','thead','tbody','tfoot','tr','colgroup','select','ul','ol'}
MAP={'class':'className','for':'htmlFor','tabindex':'tabIndex','colspan':'colSpan','maxlength':'maxLength','readonly':'readOnly','autocomplete':'autoComplete','xlink:href':'xlinkHref'}
def camel(s): return re.sub(r'-([a-z])',lambda m:m.group(1).upper(),s)
def sty(v):
    out=[]
    for d in v.split(';'):
        if ':' in d:
            k,x=d.split(':',1); k=k.strip(); out.append("%s:%r"%(camel(k) if not k.startswith('--') else repr(k),x.strip()))
    return '{{%s}}'%','.join(out)
def fix(v):
    for p in('instagram-icons/','bdaycake','bootstrap/'):
        if v.startswith(p): return '/'+v
    return v
class C(HTMLParser):
    def __init__(s): super().__init__(); s.o=[]; s.st=[]; s.body=False; s.skip=0; s.link=False
    def attrs(s,tag,at):
        r=[]; to=None
        for k,v in at:
            k=k.lower()
            if k=='src' and v=='': continue
            if tag=='a' and k=='href' and v and re.match(r'^[\w-]+\.html',v): to=ROUTES.get(v.split('.html')[0],'/'); continue
            if v is not None and k in('href','src'): v=fix(v)
            if tag=='input' and k=='checked': k='defaultChecked'
            elif tag=='input' and k=='value': k='defaultValue'
            elif k in MAP: k=MAP[k]
            elif not(k.startswith('data-') or k.startswith('aria-')): k=camel(k)
            if k=='style': r.append('style=%s'%sty(v)); continue
            r.append('%s={true}'%k if v is None else '%s="%s"'%(k,v.replace('"','&quot;')))
        return to,' '.join(r)
    def handle_starttag(s,tag,at,selfc=False):
        if tag=='body': s.body=True; return
        if tag=='script': s.skip+=1; return
        if not s.body or s.skip: return
        to,a=s.attrs(tag,at); n=tag
        if to is not None: n='Link'; a='to="%s" %s'%(to,a); s.link=True
        if tag=='form': a+=' onSubmit={(e) => e.preventDefault()}'
        if tag in VOID or selfc: s.o.append('<%s %s />'%(n,a))
        else: s.o.append('<%s %s>'%(n,a)); s.st.append(n)
    def handle_startendtag(s,tag,at): s.handle_starttag(tag,at,True)
    def handle_endtag(s,tag):
        if tag=='script': s.skip-=1; return
        if tag in('body','html') or not s.body or s.skip or tag in VOID: return
        s.o.append('</%s>'%(s.st.pop() if s.st else tag))
    def handle_data(s,d):
        if not s.body or s.skip: return
        # HTML collapses whitespace to ONE visible space; JSX drops line-edge whitespace. Keep it explicitly.
        if d.strip()=='':
            if s.st and s.st[-1] not in NOSPACE: s.o.append("{' '}")
            return
        core=d.strip().replace('{',"{'{'}").replace('}',"{'}'}")
        s.o.append(("{' '}" if d[0].isspace() else '')+core+("{' '}" if d[-1].isspace() else ''))
src,name=sys.argv[1],sys.argv[2]
c=C(); c.feed(open(src,encoding='utf-8').read().replace('\r',''))
body=re.sub(r'<(\w+)\s+>',r'<\1>',re.sub(r'<(\w+) +/>',r'<\1 />',''.join(c.o)))
imp="import { Link } from 'react-router-dom'\n" if c.link else ''
open('src/pages/user/%s.jsx'%name,'w',encoding='utf-8').write("%s\n// Converted from %s: original markup, classes and styles preserved\nexport default function %s() {\n  return (\n    <>\n%s\n    </>\n  )\n}\n"%(imp,src.split('/')[-1],name,body))
