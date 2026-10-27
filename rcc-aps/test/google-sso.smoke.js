const assert = require('assert/strict'),fs = require('fs'),vm = require('vm');
const elements = {
  googleSignInStatus:{textContent:''},
  googleSignInButton:{clientWidth:340,replaceChildren(){this.cleared=true;}},
  errBox:{classList:{add(){this.shown=true;},remove(){this.shown=false;}}},errText:{textContent:''}
};
let enabled=false,fail=false,posted,session,hydrated,configRequests=0,googleOptions;
const google = {accounts:{id:{initialize(options){googleOptions=options;},renderButton(element,options){element.buttonOptions=options;}}}};
const context = vm.createContext({window:{google},google,document:{getElementById:id=>elements[id],addEventListener(){}},setAuthToken:value=>session=value,completeLogin:async user=>hydrated=user,fetch:async(path,options)=>{
  if(path.endsWith('/config')){configRequests++;return {ok:true,json:async()=>({enabled,clientId:'test-client',domain:'rcc.edu.ph',nonce:'server-nonce'})};}
  posted={path,options};
  return {ok:!fail,json:async()=>fail?{error:'Use your verified @rcc.edu.ph school Google account.'}:{token:'payroll-session',user:{id:3,role:'employee',page:'empPage'}}};
}});
vm.runInContext(fs.readFileSync(__dirname+'/../public/js/google-sso.js','utf8'),context);
(async()=>{
 await vm.runInContext('initGoogleSignIn()',context);
 assert.match(elements.googleSignInStatus.textContent,/not available/);assert.equal(googleOptions,undefined);
 enabled=true;await vm.runInContext('initGoogleSignIn()',context);
 assert.equal(googleOptions.hd,'rcc.edu.ph');assert.equal(googleOptions.nonce,'server-nonce');assert.equal(googleOptions.auto_select,false);
 assert.equal(elements.googleSignInButton.buttonOptions.text,'continue_with');
 assert.match(elements.googleSignInStatus.textContent,/registered.*System Administrator/);
 assert.doesNotMatch(elements.googleSignInStatus.textContent,/sign in or register/i);
 await googleOptions.callback({credential:'signed-google-token'});
 assert.equal(session,'payroll-session');assert.equal(hydrated.role,'employee');
 assert.equal(posted.options.headers['X-Requested-With'],'RCC-APS');assert.equal(posted.options.credentials,'same-origin');
 assert.deepEqual(JSON.parse(posted.options.body),{credential:'signed-google-token'});
 const priorRequests=configRequests;fail=true;await googleOptions.callback({credential:'wrong-domain-token'});
 assert.match(elements.errText.textContent,/@rcc.edu.ph/);assert.equal(elements.errBox.classList.shown,true);
 assert.ok(configRequests>priorRequests,'A failed sign-in gets a fresh nonce for retry');
 const authSource=fs.readFileSync(__dirname+'/../public/js/auth.js','utf8');
 const complete = authSource.match(/async function completeLogin\(u\) \{[\s\S]*?\n}/)[0];
 let cleared=false;
 const failure = vm.createContext({document:{getElementById:id=>elements[id]},syncDemo:async()=>false,clearAuthToken(){cleared=true;}});
 vm.runInContext(complete,failure);await vm.runInContext('completeLogin({id:3,role:"employee"})',failure);
 assert.equal(cleared,true);assert.equal(failure.loggedInUser,null);assert.match(elements.errText.textContent,/Unable to load/);
 console.log('PASS: Google button setup, school-domain hint and nonce, shared Payroll session, credential-only submission, failure/retry and hydration failure handling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
