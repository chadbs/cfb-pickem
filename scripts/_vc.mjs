const token = process.env.VC_TOKEN;
const teamId = "team_2U1XyIHsLpTgIjSJ6Zw2KLU8";
const projectId = "prj_RJOIMOuQ593YEd5utc9fn7p4YhWD";
const H = { Authorization: `Bearer ${token}` };

// Find the current production deployment.
const dl = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=3&target=production`, { headers: H });
const { deployments } = await dl.json();
for (const d of deployments) console.log(`${d.uid}  state=${d.readyState}  ${new Date(d.created).toISOString()}`);

const dep = deployments[0];
// Trigger a request so there is something to log, then read runtime events.
await fetch("https://cfb-pickem-six.vercel.app/", { headers: { "User-Agent": "Mozilla/5.0" } }).catch(()=>{});
await new Promise(r => setTimeout(r, 4000));
const ev = await fetch(`https://api.vercel.com/v3/events/${dep.uid}?teamId=${teamId}&direction=backward&limit=40`, { headers: H });
const txt = await ev.text();
const lines = txt.split("\n").filter(Boolean).slice(-40);
let found = false;
for (const l of lines) {
  try {
    const o = JSON.parse(l);
    const m = o.text ?? o.payload?.text ?? "";
    if (m && /DATABASE_URL|Error|error/i.test(m)) { console.log("LOG:", m.replace(/\s+/g," ").slice(0,240)); found = true; }
  } catch {}
}
if (!found) console.log("(no matching runtime log lines returned)");
