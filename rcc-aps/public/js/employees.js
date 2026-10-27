// ── FINANCE FUNCTIONS ─────────────────────────────────────────
function updateFinStats() {
  const emps = users.filter(u=>u.status==='Active' && (u.role==='Employee' || u.role==='Finance Officer' || u.role==='System Admin') && u.salary>0);
  const teach = emps.filter(u=>u.classification==='Teaching').length;
  const nonT  = emps.length - teach;
  const el1 = document.getElementById('finTotEmp');
  const elT = document.getElementById('finTeachCnt');
  const elN = document.getElementById('finNonTeachCnt');
  if (el1) el1.textContent = emps.length;
  if (elT) elT.textContent = teach;
  if (elN) elN.textContent = nonT;
  let totGross=0, totDed=0, totNet=0;
  emps.forEach(e=>{ const g=empGrossPay(e); const d=computeDeductions(g); totGross+=g; totDed+=(d.sss+d.phil+d.pag+d.bir+d.cash+(d.customTotal||0)); totNet+=d.net; });
  const el2 = document.getElementById('finTotGross');
  const el4 = document.getElementById('finTotDed');
  const el3 = document.getElementById('finTotNet');
  if (el2) el2.textContent = fmt(totGross);
  if (el4) el4.textContent = fmt(totDed);
  if (el3) el3.textContent = fmt(totNet);
}
