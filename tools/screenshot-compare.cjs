const { chromium } = require('playwright')
const pairs = [['lg-home','Home'],['index','MobileHome'],['profile','Profile'],['message','Messages'],['notification','Notifications'],['conversation','Conversation']]
const sizes = { desktop:[1440,900], mobile:[390,844] }
;(async () => {
  const b = await chromium.launch(); const errs = []
  for (const [o,r] of pairs) for (const [s,[w,h]] of Object.entries(sizes)) {
    const pg = await b.newPage({ viewport:{width:w,height:h} })
    pg.on('console', m => m.type()==='error' && errs.push(r+':'+m.text().slice(0,100)))
    for (const [tag,url] of [['o',`orig-${o}.html`],['r',`${r}.html`]]) {
      await pg.goto('http://localhost:8765/'+url); await pg.waitForTimeout(400)
      await pg.screenshot({ path:`/home/claude/vt/${r}-${s}-${tag}.png`, fullPage:false })
    }
    await pg.close()
  }
  console.log('console errors:', errs.length, [...new Set(errs)].slice(0,5)); await b.close()
})().catch(e => { console.log('ERR', e.message.slice(0,300)); process.exit(1) })
