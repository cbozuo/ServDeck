/**
 * 服务详情页的状态规则纯函数（唯一口径：design/service-detail-state-rules.md §2 操作可用性矩阵）。
 * 状态维度：进程态 P（running/stopped/pending/unknown）× 托管态 M（managed/adopted）；
 * 全部按钮的可用性与禁用原因都由本模块计算，组件只渲染不判断。
 */

export type ProcessState = 'Running' | 'Stopped' | 'Pending' | 'Unknown';
export type ManageMode = 'managed' | 'adopted';
export type DetailAction = 'start' | 'stop' | 'restart' | 'register' | 'uninstall' | 'editDeploy' | 'saveConf';

export interface DetailAvailability {
  allowed: boolean;
  /** 禁用原因的 i18n 键（detail.rule.*）；allowed 为 true 时为空 */
  reasonKey?: string;
}

/** pending 的具体动作（转场中互斥，全部写操作禁用）。 */
export type DetailPending = 'starting' | 'stopping' | 'restarting' | 'installing' | 'uninstalling' | null;

export interface DetailRuleInput {
  processState: ProcessState;
  mode: ManageMode;
  pending: DetailPending;
  /** SCM 中是否存在此服务（快照查询结果；缺省视为已注册，兼容加载中/旧调用） */
  installed?: boolean;
  /** 启动类型为 Disabled 时启动永远禁用 */
  startTypeDisabled?: boolean;
  /** 部署参数快照缺失（旧纳管记录）→ 编辑/注册无参数可用 */
  deployMissing?: boolean;
}

const DENY = (reasonKey: string): DetailAvailability => ({ allowed: false, reasonKey });
const ALLOW: DetailAvailability = { allowed: true };

/** 转场中一律拒绝（除查看日志/事件，由组件直接不渲染写操作）。 */
const pendingDenied = (pending: DetailPending): boolean => pending !== null;

/** SCM 是否存在此服务（输入未携带时视为已注册，避免加载中误禁全部按钮）。 */
export const isInstalled = (input: DetailRuleInput): boolean => input.installed !== false;

/**
 * §2 操作可用性矩阵。
 * 设计稿规则：启动/停止/重启按进程态幂等互斥；注册与卸载要求先停止；
 * 纳管（adopted）没有注册信息 → 注册/卸载拒绝；Disabled 启动类型禁启动。
 * 未注册（installed=false）叠加一层：启停重启卸载全部拒绝，只剩注册（装入）与参数编辑。
 */
export function detailAvailability(action: DetailAction, input: DetailRuleInput): DetailAvailability {
  const { processState, pending } = input;
  const running = processState === 'Running';
  const stopped = processState === 'Stopped';

  if (pendingDenied(pending)) {
    return DENY('detail.rule.pending');
  }
  // SCM 过渡态（StartPending 等，徽章「启动中…」）：与 pending 转场同口径拒绝写操作，
  // 避免按钮 pending 结束后、SCM 未落稳定态的窗口期可再次启停/注册（配置文件保存不受进程态影响）。
  if (processState === 'Pending' && action !== 'saveConf') {
    return DENY('detail.rule.pending');
  }
  if (!isInstalled(input) && action !== 'register' && action !== 'editDeploy' && action !== 'saveConf') {
    return DENY('detail.rule.notInstalled');
  }
  switch (action) {
    case 'start':
      if (input.startTypeDisabled) return DENY('detail.rule.startDisabled');
      if (running) return DENY('detail.rule.alreadyRunning');
      return ALLOW;
    case 'stop':
      if (!running) return DENY('detail.rule.notRunning');
      return ALLOW;
    case 'restart':
      if (!running) return DENY('detail.rule.notRunning');
      return ALLOW;
    case 'register':
      // 纳管停止态注册 = 接入托管（参数可用模板默认补全），不受 deployMissing 限制
      if (running) return DENY('detail.rule.stopBeforeRegister');
      return ALLOW;
    case 'uninstall':
      // 纳管服务也允许卸载（可能本来就是 servy 装的）：由前端强确认兜底；
      // 运行中仍拒绝（SCM 无法删除运行中的服务）。
      if (running) return DENY('detail.rule.stopBeforeUninstall');
      return ALLOW;
    case 'editDeploy':
      if (input.deployMissing) return DENY('detail.rule.deployMissing');
      if (pendingDenied(pending)) return DENY('detail.rule.pending');
      if (running) return DENY('detail.rule.stopBeforeEdit');
      return ALLOW;
    case 'saveConf':
      if (pendingDenied(pending)) return DENY('detail.rule.pending');
      return ALLOW;
    default:
      return ALLOW;
  }
}

/** Hero 上实际渲染哪些命令按钮：托管五命令；纳管四命令（无「重新注册」，卸载带强确认）。 */
export function heroActions(mode: ManageMode): DetailAction[] {
  return mode === 'managed'
    ? ['start', 'stop', 'restart', 'register', 'uninstall']
    : ['start', 'stop', 'restart', 'uninstall'];
}

/** pending 态的文案 i18n 键（detail.pending.*）。 */
export function pendingTextKey(pending: DetailPending): string | null {
  if (!pending) return null;
  return `detail.pending.${pending}`;
}

/** 由原始 SCM 状态串归一化为规则用的进程态。 */
export function normalizeProcessState(state: string, pending: DetailPending): ProcessState {
  if (pending) return 'Pending';
  if (state === 'Running') return 'Running';
  if (state === 'Stopped') return 'Stopped';
  if (state === 'Unknown' || state === '') return 'Unknown';
  return 'Pending'; // StartPending 等中间态归入转场
}
