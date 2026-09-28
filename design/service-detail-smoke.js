/* ServDeck 服务详情页原型 · 冒烟校验工具（长期保留，随原型迭代同步断言）
   用法：node design/service-detail-smoke.js
   覆盖：语法 / 运行时（4 服务 × 4 页签）/ 状态×操作矩阵 / 信息去重 / 口径标注 / 死引用 / 未用图标 / 标签配平 */
const fs = require('fs');
const vm = require('vm');
const P = 'C:/workspace/zcode/ServDeck/design/service-detail-page-v2.html';
const html = fs.readFileSync(P, 'utf8');

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('NO SCRIPT'); process.exit(1); }
try { new vm.Script(m[1], { filename: 'inline.js' }); console.log('SYNTAX OK'); }
catch (e) { console.log('SYNTAX FAIL ' + e.message); process.exit(1); }
const src = m[1];

const noop = () => {};
function mkStyle() {
  const s = {};
  return new Proxy(s, {
    get(t, k) { if (k === 'setProperty' || k === 'removeProperty') return noop; if (k === 'getPropertyValue') return () => ''; return t[k] !== undefined ? t[k] : ''; },
    set(t, k, v) { t[k] = v; return true; }
  });
}
function mk() {
  const t = {};
  return new Proxy(t, {
    get(tt, k) {
      switch (k) {
        case 'style': return tt.style || (tt.style = mkStyle());
        case 'dataset': return tt.dataset || (tt.dataset = {});
        case 'classList': return { add: noop, remove: noop, toggle: noop, contains: () => false };
        case 'querySelectorAll': return () => [];
        case 'querySelector': return () => mk();
        case 'closest': return () => mk();
        case 'getBoundingClientRect': return () => ({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
        case 'hidden': return tt.hidden === undefined ? false : tt.hidden;
        case 'disabled': return false;
        case 'value': return tt.value !== undefined ? tt.value : '';
        case 'innerHTML': return tt.innerHTML !== undefined ? tt.innerHTML : '';
        case 'textContent': return tt.textContent !== undefined ? tt.textContent : '';
        case 'offsetWidth': case 'offsetLeft': case 'scrollHeight': case 'scrollTop': return 0;
        case 'hasAttribute': return () => false;
        case 'firstElementChild': return mk();
        case 'matches': return () => false;
        case 'contains': return () => false;
        case 'toLocaleString': return () => '';
        case 'addEventListener': case 'removeEventListener': case 'setAttribute': case 'removeAttribute':
        case 'scrollIntoView': case 'click': case 'focus': case 'appendChild': case 'prepend':
        case 'insertAdjacentHTML': case 'setSelectionRange': case 'remove': case 'replaceWith': return noop;
        default: return tt[k] !== undefined ? tt[k] : '';
      }
    },
    set(tt, k, v) { tt[k] = v; return true; }
  });
}
global.document = {
  querySelector: () => mk(), querySelectorAll: () => [], getElementById: () => mk(),
  createElement: () => mk(), createElementNS: () => mk(), body: mk(), addEventListener: noop,
};
global.window = { addEventListener: noop, innerWidth: 1200, matchMedia: () => ({ matches: false }) };
global.navigator = { clipboard: null };
global.requestAnimationFrame = cb => { if (cb) cb(); };
global.setTimeout = cb => { if (typeof cb === 'function') cb(); return 0; };
global.setInterval = () => 0;
global.getComputedStyle = () => mkStyle();

const test = `
  let n = 0;
  const names = Object.keys(SERVICES);
  const tabs = TABS.map(t => t[0]);
  for (const nm of names) {
    openDetail(nm);
    for (const t of tabs) { activeTab = t; renderPane(); n++; }
    current = nm; n++;
  }
  openDetail(names[0]);
  setState(SERVICES[names[0]], 'restarting', 'Running', { d: 'run', html: 'x' });
  setState(SERVICES[names[0]], 'stopping', 'Stopped', { d: 'stop', html: 'y' });
  setState(SERVICES[names[0]], 'starting', 'Running', { d: 'run', html: 'z' });
  askRegister(SERVICES[names[1]]);
  askUninstall(SERVICES[names[3]]);
  console.log('  pane renders: ' + n);

  const btnState = html => {
    const out = {};
    ['start','stop','restart','register','uninstall'].forEach(a => {
      const mm = html.match(new RegExp('data-act="' + a + '"[^>]*'));
      out[a] = mm ? (mm[0].includes('disabled') ? 'OFF' : 'ON') : 'MISSING';
    });
    return out;
  };
  const show = (label, s) => console.log('  ' + label + ' -> ' + JSON.stringify(btnState(detailHero(s))));
  const wh = SERVICES['WEC-AI-PLATFORM'];
  const my = SERVICES['mysql-local'];
  wh.state = 'Running'; wh._pending = null; wh.registered = true; wh.startType = 'Automatic';
  show('运行中+托管    ', wh);
  wh.state = 'Stopped';
  show('已停止+托管    ', wh);
  wh.startType = 'Automatic'; wh._pending = 'restarting';
  show('转场中        ', wh);
  wh._pending = null;
  my.state = 'Running'; my._pending = null; my.registered = false;
  show('运行中+纳管    ', my);
  my.state = 'Stopped';
  show('已停止+纳管    ', my);
  my.state = 'Running';

  const cnt = (str, re) => (str.match(re) || []).length;
  wh.state = 'Running';
  const dl = paneDeploy(wh);
  console.log('  deploy 运行中 -> lock:' + dl.includes('lock-bar') + ' readonly:' + cnt(dl, /readonly/g) + ' disabled:' + cnt(dl, /disabled/g));
  wh.state = 'Stopped';
  const doo = paneDeploy(wh);
  console.log('  deploy 已停止 -> lock:' + doo.includes('lock-bar') + ' readonly:' + cnt(doo, /readonly/g) + ' disabled:' + cnt(doo, /disabled/g));
  wh.state = 'Running';

  const o = paneOverview(wh);
  console.log('  概览 资源卡:' + cnt(o, /class="res-card/g) + '(应 8) 最近事件:' + o.includes('最近事件') + ' 网络卡进程口径:' + o.includes('进程网络 I/O'));
  console.log('  概览 无机器级信息:' + !o.includes('所在磁盘剩余') + ' 无连续运行:' + !o.includes('连续运行'));

  /* 字段收敛断言：由程序文件/数据根目录派生的字段不再作为独立输入 */
  console.log('  派生字段已删(工作目录/应用参数/日志目录):'
    + (!dl.includes('data-field="workDir"') && !dl.includes('data-field="appArgs"') && !dl.includes('data-field="logDir"')) + '(应 true)');
  console.log('  rustfs 启动参数保留:' + paneDeploy(SERVICES['rustfs-service']).includes('data-field="params"') + '(应 true)');
  console.log('  纳管信息程序文件行含打开所在目录:' + dl.includes('data-act="open-workdir"') + '(应 true)');
  console.log('  JVM 常用参数区:' + dl.includes('jvm-presets') + '(应 true) chips数:' + cnt(dl, /data-jvm-flag/g) + '(应 6)');
  console.log('  堆内存滑杆(运行中已锁):' + cnt(dl, /class="heap-range"[^>]*disabled/g) + '(应 1) 档位:' + HEAP_STOPS.join('/') + ' 上限:' + HEAP_STOPS[HEAP_STOPS.length - 1] + 'G(本机' + HOST_MEM_GB + 'G)');
  console.log('  堆内存滑杆(已停止可用):' + cnt(doo, /class="heap-range"/g) + '(应 1) 禁用:' + cnt(doo, /class="heap-range"[^>]*disabled/g) + '(应 0) 默认2G档:' + doo.includes('value="2"') + ' 数值输入框:' + doo.includes('data-heap-input value="2G"'));
  console.log('  运行中 chips 已禁用:' + cnt(dl, /preset-chip[^>]*disabled/g) + '(应 6)');
  console.log('  启动类型分段按钮:' + cnt(dl, /data-act="start-type"/g) + '(应 4) select已移除:' + !dl.includes('data-field="startType"'));

  const cmd = buildCommand(wh);
  console.log('  --params 派生:' + cmd.includes('-Xms2g -Xmx2g -jar wec-ai-platform.jar'));
  console.log('  --startupDir 派生:' + cmd.includes('--startupDir="D:\\\\wec-ai-platform"'));
  console.log('  --stdout 派生自数据根目录:' + cmd.includes('.servdeck\\\\logs\\\\WEC-AI-PLATFORM'));
  console.log('  启动命令:' + runCommand(wh));

  const heroHtml = detailHero(wh);
  console.log('  Hero 告警pill:' + heroHtml.includes('hero-alert') + '(应 true) 悬浮卡已删:' + !heroHtml.includes('hi-pop') + '(应 true)');
  console.log('  rustfs Hero 无告警:' + !detailHero(SERVICES['rustfs-service']).includes('hero-alert') + '(应 true)');

  openDetail(names[0]);
  openJdkPicker();
  jdkPick = 1; renderJdkList(); applyJdk();
  console.log('  JDK 应用后 --path 同步:' + commandPreview(SERVICES[names[0]]).includes('jdk-21') + '(应 true)');
  console.log('  同步后 --params 仍完整:' + commandPreview(SERVICES[names[0]]).includes('-jar wec-ai-platform.jar') + '(应 true)');
  SERVICES[names[0]].deploy.javaPath = 'C:\\\\Program Files\\\\Java\\\\jdk-17\\\\bin\\\\java.exe';

  console.log('SMOKE PASS');
`;

try {
  new Function(src + '\n' + test)();
} catch (e) {
  console.log('SMOKE FAIL: ' + e.message);
  console.log(e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

const refs = [...html.matchAll(/\$\('([a-zA-Z0-9\-]+)'\)/g)].map(x => x[1]);
const ids = [...html.matchAll(/id="([a-zA-Z0-9\-]+)"/g)].map(x => x[1]);
const dynamic = ['dtHero', 'dtPane', 'instSteps', 'trendChart',
  'rCpu', 'rMem', 'rThr', 'rHnd', 'rMemBar', 'lgCpu', 'lgMem', 'lgThr',
  'cmdBody', 'confFields', 'confRaw', 'confModeSeg', 'restartBar', 'logView',
  'st1', 'st2', 'st3', 'phSvc', 'jdkList', 'jdkManual'];
const miss = [...new Set(refs)].filter(r => !ids.includes(r) && !dynamic.includes(r));
console.log('dangling $() refs:', miss.join(', ') || '(none)');

['paneRuntime', 'endpointPanel', 'checkPorts', 'portsHtml', 'port-row',
  'dtStrip', 'stat-strip', 'detailStrip', 'renderStrip', 'dirTotal', 'dirPct', 'dirFree',
  'icon-more', 'info-grid', 'jarFile', 'jarSize', 'jarMtime', 'd.workDir', 'd.appArgs', 'd.logDir']
  .forEach(k => { if (html.includes(k)) console.log('RESIDUAL REF:', k); });

const used = new Set();
[...html.matchAll(/href="#(i-[a-z0-9-]+)"/g)].forEach(x => used.add(x[1]));
[...html.matchAll(/['"](i-[a-z0-9-]+)['"]/g)].forEach(x => used.add(x[1]));
const defined = [...html.matchAll(/<symbol id="(i-[a-z0-9-]+)"/g)].map(x => x[1]);
console.log('unused symbols:', defined.filter(d => !used.has(d)).join(', ') || '(none)');

['div', 'section', 'aside', 'main', 'style', 'script'].forEach(tag => {
  const o = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
  const c = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  if (o !== c) console.log('TAG MISMATCH <' + tag + '> open=' + o + ' close=' + c);
});
console.log('tag balance checked');
