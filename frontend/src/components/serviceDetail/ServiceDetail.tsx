import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useI18n } from '../../i18n/provider';
import { useServiceRegistryStore } from '../../serviceRegistryStore';
import { useServiceDetailStore } from '../../serviceDetailStore';
import { useHomeEventsStore } from '../home/homeEvents';
import {
  AddManagedService,
  CheckServicePorts,
  ControlWindowsService,
  SaveServiceConf,
  UninstallServyService,
} from '../../../wailsjs/go/app/App';
import { useServiceDetail, type ServiceDetailData } from './useServiceDetail';
import { buildDefaultDeploy, deployProcessParams } from './defaultDeploy';
import { getDbIconAssetSrc } from '../DatabaseIcons';
import { DetailLookPane } from './DetailLookPane';
import { DetailHero } from './DetailHero';
import { DetailOverviewPane } from './DetailOverviewPane';
import { DetailDeployPane } from './DetailDeployPane';
import { DetailLogsPane } from './DetailLogsPane';
import { DetailEventsPane } from './DetailEventsPane';
import type { DetailTrendPoint } from './detailTrend';
import { pushTrendPoint, DETAIL_TREND_POINTS } from './detailTrend';
import type { DetailPending } from './detailRules';
import './serviceDetail.css';

type DetailTab = 'overview' | 'deploy' | 'look' | 'logs' | 'events';

const TAB_KEYS: DetailTab[] = ['overview', 'deploy', 'look', 'logs', 'events'];

// 图标解析与列表页同口径（getDbIconAssetSrc 查 BRAND_ASSET_CONFIGS 的真实后缀，
// 如 rustfs.png）——曾自行拼 .svg 后缀，非 svg 图标类型（rustfs 等）在详情页破图
const resolveIconSrc = (serviceType: string, iconDataUrl?: string): string =>
  iconDataUrl || getDbIconAssetSrc(serviceType);

/**
 * 服务详情页（workbench tab 形态，每服务一个 tab，可拖出为浮层窗口）：
 * 返回导航 + Hero（五命令/可用性矩阵/确认弹窗/pending 流）+ 概览/部署/日志/事件四页签。
 * 数据经 useServiceDetail 轮询；启停接 ControlWindowsService，注册接快照+AddManagedService，卸载接 servy-cli。
 */
export const ServiceDetail: React.FC<{ name: string }> = ({ name }) => {
  const { t } = useI18n();
  const close = useServiceDetailStore((state) => state.close);
  const services = useServiceRegistryStore((state) => state.services);
  const addService = useServiceRegistryStore((state) => state.addService);
  const entry = useMemo(() => services.find((item) => item.name === name), [name, services]);
  const detail = useServiceDetail(name, entry?.deploy, true);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [trend, setTrend] = useState<DetailTrendPoint[]>([]);
  const trendRef = useRef<DetailTrendPoint[]>([]);

  const accentColor = entry?.accentColor;
  const iconSrc = resolveIconSrc(entry?.serviceType ?? 'java', entry?.iconDataUrl);
  const running = detail.ruleInput.processState === 'Running';
  // 锁定 = 运行中 / 本页操作转场中 / SCM 过渡态（StartPending 等——徽章显示「启动中…」
  // 时 SCM 尚未落到稳定态，参数必须保持锁定，否则过渡期可编辑会误导）
  const locked = running || detail.pending !== null || detail.ruleInput.processState === 'Pending';

  // 趋势缓冲：详情可见期间每轮采样推入
  useEffect(() => {
    const s = detail.sample;
    if (!s || !running) {
      return;
    }
    const next = pushTrendPoint(trendRef.current, {
      at: Date.now(),
      cpuPct: s.cpuPct ?? 0,
      memMB: Math.round((s.memBytes ?? 0) / 1024 ** 2),
      threads: s.threads ?? 0,
    });
    trendRef.current = next;
    setTrend(next);
  }, [detail.sample, running]);

  // 服务被移出纳管列表（树右键移除 / 残留清理）时自动关闭详情页，回到服务总览。
  // 只在"曾存在 → 消失"时触发，避免 store 未就绪时的误关闭。
  const seenRef = useRef(false);
  useEffect(() => {
    if (entry) {
      seenRef.current = true;
    } else if (seenRef.current) {
      seenRef.current = false;
      close();
    }
  }, [entry, close]);

  const runPending = useCallback(async (pending: Exclude<DetailPending, null>, action: () => Promise<void>) => {
    detail.setPending(pending);
    try {
      await action();
    } finally {
      detail.setPending(null);
      await detail.refreshAfterAction();
      // 操作完成后 SCM 可能仍在过渡（servy 启动超时返回 ≠ 启动结束）：
      // 跟随刷新直至落稳；状态已稳时跟随器首个 tick 即自行停止
      detail.followUntilStable();
    }
    // detail.setPending/refreshAfterAction/followUntilStable 均为稳定引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const handleControl = useCallback(
    (action: 'start' | 'stop' | 'restart') => {
      void runPending(
        action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'restarting',
        async () => {
          const result = await ControlWindowsService(name, action);
          if (!result.success) {
            message.error(result.message || t('home.backend.error.control_failed', { detail: '' }));
            return;
          }
          // 详情页打开时首页轮询不挂载，状态 diff 不会产生事件——操作事件在此直接记录
          useHomeEventsStore.getState().pushEvent({
            at: Date.now(),
            level: 'run',
            name,
            service: entry?.displayName || name,
            key: action === 'stop'
              ? 'home.events.stopped'
              : action === 'start'
                ? 'home.events.started'
                : 'home.events.restart',
          });
        },
      );
    },
    [entry, name, runPending, t],
  );

  const handleRegister = useCallback(() => {
    void runPending('installing', async () => {
      if (!entry) {
        return;
      }
      // 注册参数以部署页当前草稿为准（草稿为空回退纳管快照）；两者皆无（历史遗留无快照
      // 记录 / 外部纳管服务）按模板默认值补全，落实「注册 = 接入托管」的矩阵口径。
      // 服务已卸载时 SCM 查不到程序路径，程序文件/显示名回退纳管记录里的值。
      const d = detail.deployDraft ?? entry.deploy
        ?? buildDefaultDeploy(entry.serviceType, name, {
          ...(detail.info ?? {}),
          programFile: detail.info?.programFile || entry.programFile,
          displayName: detail.info?.displayName || entry.displayName,
        });
      if (!d) {
        message.warning(t('detail.deploy.emptyTitle'));
        return;
      }
      const isJava = entry.serviceType === 'java';
      // 重新注册 = 停止 → 卸载旧注册 → 注册（servy install + start）；未注册时前两步静默跳过
      await ControlWindowsService(name, 'stop').catch(() => undefined);
      await UninstallServyService(name).catch(() => undefined);
      const result = await AddManagedService({
        mode: 'register',
        serviceType: entry.serviceType,
        name,
        displayName: d.displayName,
        description: d.description ?? '',
        // servy -p 是进程可执行文件：Java 传 java.exe（快照的 programFile 是 jar）
        programFile: isJava ? (d.javaPath || d.programFile) : d.programFile,
        params: deployProcessParams(entry.serviceType, d),
        workDir: d.workDir ?? '',
        startType: d.startType,
        restart: d.restart,
        rotate: d.rotate ?? d.restart,
        // 重新注册走只注册不启动：失败过的服务先停在 Stopped，由用户手动启动验证
        skipStart: true,
        confName: d.confName ?? '',
        confContent: d.confContent ?? '',
      });
      if (!result.success) {
        message.error(result.message || t('detail.register.failed'));
        return;
      }
      useHomeEventsStore.getState().pushEvent({
        at: Date.now(),
        level: 'run',
        name,
        service: d.displayName || name,
        key: 'home.events.registered',
      });
      addService({ ...entry, deploy: d });
      detail.setDeployDirty(false);
      message.success(t('detail.register.done'));
    });
  }, [addService, entry, detail, name, runPending, t]);

  const handleUninstall = useCallback(() => {
    void runPending('uninstalling', async () => {
      // 先停再卸：SCM 拒绝删除运行中的服务；状态采样滞后（显示已停、进程未退）时
      // 这一步兜底等进程真正退出，避免卸载中途失败报错。
      await ControlWindowsService(name, 'stop').catch(() => undefined);
      const result = await UninstallServyService(name);
      if (!result.success) {
        message.error(result.message || t('detail.uninstall.failed'));
        return;
      }
      useHomeEventsStore.getState().pushEvent({
        at: Date.now(),
        level: 'warn',
        name,
        service: entry?.displayName || name,
        key: 'home.events.uninstalled',
      });
      // 保留纳管记录与部署参数：详情页随即转入「未注册」形态，可直接改参数重新注册
      message.success(t('detail.uninstall.done'));
    });
  }, [entry, name, runPending, t]);

  const handleSaveConf = useCallback(
    async (file: string, content: string) => {
      const result = await SaveServiceConf(name, file, content);
      if (result.success) {
        message.success(t('detail.conf.saved'));
        detail.setDeployDirty(true);
      } else {
        message.error(result.message || t('detail.conf.saveFailed'));
      }
    },
    [detail, name, t],
  );

  const dirLabel = t('detail.res.dirProgram');
  const memMaxMB = useMemo(() => {
    // 堆上限 = -Xmx（托管 Java 服务）；未配置时不显示上限
    const m = entry?.deploy?.jvmArgs?.match(/-Xmx(\d+)([mg])/i);
    if (!m) return undefined;
    const n = parseInt(m[1], 10);
    return m[2].toLowerCase() === 'g' ? n * 1024 : n;
  }, [entry?.deploy?.jvmArgs]);

  const detailData: ServiceDetailData = {
    info: detail.info,
    sample: detail.sample,
    ports: detail.ports,
    portTotal: detail.ports.length,
    portOkCount: detail.ports.filter((p) => p.listening).length,
    dirBytes: detail.dirBytes,
  };
  void detailData;

  return (
    <div className="dtl-root">
      <DetailHero
        info={detail.info}
        sample={detail.sample}
        ports={detail.ports}
        pending={detail.pending}
        ruleInput={detail.ruleInput.input}
        accentColor={accentColor}
        iconSrc={iconSrc}
        onControl={handleControl}
        onRegister={handleRegister}
        onUninstall={handleUninstall}
      />

      <div className="dtl-tabs">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`dtl-tab${tab === key ? ' on' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`detail.tab.${key}`)}
            {key === 'deploy' && !locked && detail.deployDirty ? <i className="dtl-dot-badge" /> : null}
          </button>
        ))}
      </div>

      {/* 日志/事件页签：内容区弹性填满 Hero/Tabs 之下的剩余视口（输出框自适应高）；其余页签自然高度 */}
      <div className={`dtl-body${tab === 'logs' || tab === 'events' ? ' dtl-body-fill' : ''}`}>
        {tab === 'overview' && (
          <DetailOverviewPane
            info={detail.info}
            sample={detail.sample}
            ports={detail.ports}
            dirBytes={detail.dirBytes}
            dirLabel={dirLabel}
            trend={trend}
            memMaxMB={memMaxMB}
            running={running}
            onOpenEvents={() => setTab('events')}
          />
        )}
        {tab === 'deploy' && (
          <DetailDeployPane
            info={detail.info}
            serviceType={entry?.serviceType ?? 'java'}
            deploy={detail.deployDraft}
            deployDirty={detail.deployDirty}
            locked={locked}
            installed={detail.info ? detail.info.installed !== false : true}
            onDeployChange={(next) => {
              detail.setDeployDraft(next);
              detail.setDeployDirty(true);
            }}
            onConfSave={handleSaveConf}
            addedAt={entry?.addedAt}
          />
        )}
        {tab === 'look' && entry && (
          <DetailLookPane
            entry={entry}
            onApply={(next) => addService({ ...entry, iconDataUrl: next.iconDataUrl, accentColor: next.accentColor })}
          />
        )}
        {tab === 'logs' && (
          <DetailLogsPane name={name} logDir={detail.info?.logDir || entry?.logDir || ''} enabled />
        )}
        {tab === 'events' && (
          <DetailEventsPane name={name} displayName={detail.info?.displayName || name} />
        )}
      </div>
    </div>
  );
};

// CheckServicePorts 在 Hero 内经由 useServiceDetail 已轮询；此处 re-export 仅为保持导入面完整
export { CheckServicePorts };

export default ServiceDetail;
