// Local UI only. Every API call is intercepted; no mail, VIES, payment or DB I/O.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
  try { for (const width of [1440,390]) {
    const context = await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000},acceptDownloads:true});
    await context.addInitScript(() => {
      const createdAt=Date.now();
      for(const [key,value] of [['ws_auth_token','test'],['ws.lang','pl']]) sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt,expiresAt:createdAt+43200000}));
    });
    const ref='WEB-2-20261118-ABCDEF';
    let companies=[], invoice=null, issued=0, issueAttempts=0, emailAttempts=0;
    const order={orderRef:ref,status:'completed',total:22,itemsCount:2,mode:'collect',payment:{method:'shop',status:'paid'},slot:{dateTime:'2026-11-18 12:00:00'}};
    const errors=[];
    await context.route('**/*',async route => {
      const request=route.request(), url=new URL(request.url()), path=url.pathname;
      if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname)) return route.abort();
      if(!path.includes('/api/v1/')) return route.continue();
      let body=[],status=200;
      if(path.endsWith('/shops')) body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
      else if(path.endsWith('/clients/auth/me')) body={user:{id:42,email:'buyer@example.invalid',firstName:'Buyer',lastName:'Person',postalCode:'1435',activationRequired:false}};
      else if(path.endsWith('/clients/auth/refresh')) body={access_token:'test',session_transport:'cookie'};
      else if(path.endsWith('/products/available')) body=[{id:11,name:'Bread',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[]},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
      else if(path.includes('/webshop/billing/companies')) {
        if(request.method()==='POST' && path.endsWith('/companies')) {
          const data=request.postDataJSON(), id=50+companies.length;
          companies.push({id,name:'Company '+id,vat:'BE'+data.vat,address:'Main 1',isDefault:!companies.length});
        } else if(path.endsWith('/default')) {
          const id=Number(path.split('/').at(-2));companies=companies.map(c=>({...c,isDefault:c.id===id})).sort((a,b)=>Number(b.isDefault)-Number(a.isDefault));
        } else if(request.method()==='DELETE') {
          companies=companies.filter(c=>c.id!==Number(path.split('/').at(-1)));
          if(companies.length&&!companies.some(c=>c.isDefault))companies[0].isDefault=true;
        }
        body=companies;
      } else if(path.endsWith('/webshop/billing/orders/'+ref+'/pdf')) {
        return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\nfixture'});
      } else if(path.endsWith('/webshop/billing/orders/'+ref+'/email')) {
        assert.equal(request.postDataJSON().email,'copy@example.invalid');emailAttempts++;
        status=emailAttempts===1?503:200;body=status===200?{sent:true}:{description:'BILLING_UNAVAILABLE'};
      } else if(path.endsWith('/webshop/billing/orders/'+ref)) {
        if(request.method()==='POST') {
          const data=request.postDataJSON();
          assert.deepEqual(data,{companyId:51,po:'PO-123',reference:'Department A'});
          issueAttempts++;
          if(!invoice){issued++;invoice={id:1,invoice_number:'260001',consignee_name:'Company 51',consignee_tax_number:'BE0987654321',po_hash:data.po,reference_comment:data.reference};}
          status=issueAttempts===1?503:200;
          body=status===200?{invoice,idempotent:true}:{description:'BILLING_UNAVAILABLE'};
        } else body={invoice,eligible:!invoice};
      } else if(path.endsWith('/webshop/orders/me')) body=[order];
      else if(path.endsWith('/webshop/orders/'+ref)) body={...order,billing:{mode:'person'},items:[{id:1,name:'Historical bread',quantity:2,unitGrossPrice:10,discountValue:2,totalGross:18}],pricing:{totals:{gross_after_discount:22}}};
      else if(path.endsWith('/config')||path.endsWith('/brand'))body={};
      return route.fulfill({status,json:body});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(15000);
    async function account(){
      const mobile=page.locator('.ws-tabbar__btn--account:visible');
      if(await mobile.count())await mobile.click();else await page.getByRole('button',{name:'Konto',exact:true}).first().click();
    }
    async function purchase(){
      const purchases=page.getByRole('button',{name:'Moje zamówienia',exact:true});
      if(await purchases.count())await purchases.click();
      await page.locator('.ws-purchase-actions button').first().click();
      await page.locator('.ws-purchase-invoice').waitFor();
    }
    await page.goto('https://webshop.tfbuddy.local/?shop=2');await page.locator('.ws-card').first().waitFor();
    await page.getByRole('button',{name:/^(Odrzuć opcjonalne|Rozumiem)$/}).click();
    await account();
    const companySection=page.locator('.ws-billing-companies');await companySection.locator('input').waitFor();
    await companySection.locator('input').fill('0123456789');await companySection.getByRole('button',{name:'Dodaj firmę',exact:true}).click();
    await companySection.getByText('Company 50',{exact:true}).waitFor();
    await companySection.locator('input').fill('0987654321');await companySection.getByRole('button',{name:'Dodaj firmę',exact:true}).click();
    await companySection.getByText('Company 51',{exact:true}).waitFor();
    await companySection.getByRole('button',{name:'Ustaw jako domyślną',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.ws-billing-companies .ws-acc__card strong')?.textContent==='Company 51');
    await purchase();
    const section=page.locator('.ws-purchase-invoice');await section.getByRole('button',{name:'Wystaw fakturę',exact:true}).waitFor();
    assert.equal(await section.locator('select').inputValue(),'51');
    await section.getByLabel('PO#',{exact:true}).fill('PO-123');await section.locator('textarea').fill('Department A');
    await section.getByRole('button',{name:'Wystaw fakturę',exact:true}).click();await section.locator('[role=alert]').waitFor();
    await section.getByRole('button',{name:'Wystaw fakturę',exact:true}).click();await section.getByText('260001',{exact:true}).waitFor();
    assert.equal(issued,1);assert.equal(issueAttempts,2);
    await section.getByRole('textbox').fill('copy@example.invalid');await section.getByRole('button',{name:'Wyślij fakturę',exact:true}).click();await section.locator('[role=alert]').waitFor();
    await section.getByRole('button',{name:'Wyślij fakturę',exact:true}).click();await section.getByText('Faktura została wysłana.',{exact:true}).waitFor();
    const downloading=page.waitForEvent('download');await section.getByRole('button',{name:'Pobierz fakturę',exact:true}).click();
    assert.equal((await downloading).suggestedFilename(),'invoice-260001.pdf');
    fs.mkdirSync('/tmp/webshop-billing-ui',{recursive:true});
    await section.screenshot({path:'/tmp/webshop-billing-ui/invoice-'+width+'.png'});
    await page.reload();await page.locator('.ws-card').first().waitFor();await account();await purchase();
    await page.locator('.ws-purchase-invoice').getByText('260001',{exact:true}).waitFor();
    assert.equal(await page.locator('.ws-purchase-invoice').getByRole('button',{name:'Wystaw fakturę',exact:true}).count(),0);
    assert.equal(issued,1);assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log('PASS billing companies, default, issue retry, PDF, email retry and reload at '+width);
    await context.close();
  }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
