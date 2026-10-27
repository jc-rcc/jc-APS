let googleLoginBusy = false;
let googleScriptReady;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptReady) googleScriptReady = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { script.remove(); googleScriptReady = null; reject(new Error('Google sign-in could not load. Check your connection.')); };
    document.head.appendChild(script);
  });
  return googleScriptReady;
}

async function initGoogleSignIn() {
  const status = document.getElementById('googleSignInStatus');
  const container = document.getElementById('googleSignInButton');
  try {
    const response = await fetch('/api/auth/google/config',{cache:'no-store',credentials:'same-origin'});
    if (!response.ok) throw new Error('Google sign-in is temporarily unavailable.');
    const config = await response.json();
    if (!config.enabled) { status.textContent = 'Google sign-in is not available yet.'; return; }
    await loadGoogleIdentity();
    google.accounts.id.initialize({client_id:config.clientId,callback:handleGoogleSignIn,nonce:config.nonce,hd:config.domain,auto_select:false});
    container.replaceChildren();
    google.accounts.id.renderButton(container,{type:'standard',theme:'outline',size:'large',text:'continue_with',shape:'rectangular',width:Math.min(400,container.clientWidth || 320)});
    status.textContent = 'Use your registered @rcc.edu.ph account. Contact the System Administrator if you need an account.';
  } catch (error) { status.textContent = error.message; }
}

async function handleGoogleSignIn(result) {
  if (googleLoginBusy) return;
  googleLoginBusy = true;
  const status = document.getElementById('googleSignInStatus');
  const err = document.getElementById('errBox');
  err.classList.remove('show');
  status.textContent = 'Signing in with Google...';
  try {
    const response = await fetch('/api/auth/google',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'RCC-APS'},
      body:JSON.stringify({credential:result.credential})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to sign in with Google.');
    setAuthToken(data.token);
    await completeLogin(data.user);
  } catch (error) {
    document.getElementById('errText').textContent = error.message;
    err.classList.add('show');
  } finally {
    googleLoginBusy = false;
    await initGoogleSignIn();
  }
}

document.addEventListener('DOMContentLoaded',initGoogleSignIn);
