import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, message } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  ExclamationCircleFilled,
  FolderOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import {
  DetectJavaRuntimes,
  DescribeJavaRuntime,
  ProbeWindowsService,
  SelectDirectory,
} from '../../wailsjs/go/app/App';
import './jdkPickerModal.css';

/** 设计稿 md-ico 的咖啡杯线条图标（stroke 跟随 currentColor，主题自动适配）。 */
const CoffeeIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M3 6.5h8.5v3.2a3.3 3.3 0 0 1-3.3 3.3H6.3a3.3 3.3 0 0 1-3.3-3.3V6.5Z" stroke="currentColor" strokeWidth="1.3" />
    <path d="M11.5 7.2h1.2a1.6 1.6 0 0 1 0 3.2h-1.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.2 4.2c0-.9 1.2-.9 1.2-1.8M8 4.2c0-.9 1.2-.9 1.2-1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** DetectJavaRuntimes 返回的一个本机 Java 运行时候选。 */
interface JdkCandidate {
  version: number;
  name: string;
  path: string;
}

/** 手动路径校验状态。 */
type ManualState = 'idle' | 'checking' | 'ok' | 'bad';

/** DescribeJavaRuntime 成功时的版本元信息。 */
interface ManualRuntimeInfo {
  name?: string;
  version?: number;
}

/** 手动输入校验防抖：避免每个字符都打一次后端探测。 */
const MANUAL_CHECK_DEBOUNCE_MS = 400;

/** 「检测中 → 结果」的最短过渡时长：接口常瞬间返回，固定保留 400ms 让状态变化可感知。 */
const DETECT_MIN_DURATION_MS = 400;

/** 文件存在性复用探测绑定（空服务名 = 只查文件，见 ProbeWindowsService）。 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const result = await ProbeWindowsService('', path);
    return result.success === true &&
      (result.data as { fileExists?: boolean } | null | undefined)?.fileExists === true;
  } catch {
    return false;
  }
}

/** 取当前时间的 HH:mm，用于「上次检测」元信息。 */
function clockNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * 富文本渲染：i18n 文案中的 «词语» 渲染为加粗（fg-2），{{占位符}} 渲染为加粗值。
 * 对齐高保真：说明里的「JDK 目录 / java.exe 完整路径」与检测数量加粗。
 */
function renderRich(text: string, values?: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/(«[^»]*»|\{\{\w+\}\})/).map((part, index) => {
    const guillemet = part.match(/^«([^»]*)»$/);
    if (guillemet) {
      return <b key={index}>{guillemet[1]}</b>;
    }
    const placeholder = part.match(/^\{\{(\w+)\}\}$/);
    if (placeholder) {
      return <b key={index}>{values?.[placeholder[1]]}</b>;
    }
    return part;
  });
}

/**
 * 「选择 JDK」弹窗（对齐高保真 design/jdk-picker-v1.html）：
 * 检测元信息 + 重新检测 / 候选项卡片列表（radio 行首、vendor 分级、路径悬停复制）/
 * 手动指定（与列表互斥单选，校验通过后选中态转移到手动框并显示版本信息）/
 * 三态反馈（空态 · 检测中骨架屏 · 校验结果）/ 底栏「快捷键提示 + 单主按钮」。
 */
export const JdkPickerModal: React.FC<{
  open: boolean;
  currentPath: string;
  zIndex?: number;
  onClose: () => void;
  onApply: (path: string) => void;
  /** 关闭动画结束（antd 已把焦点还原到触发按钮）后回调；调用方借此把焦点还给输入框。 */
  onClosed?: () => void;
}> = ({ open, currentPath, zIndex, onClose, onApply, onClosed }) => {
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<JdkCandidate[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectedAt, setDetectedAt] = useState('');
  const [picked, setPicked] = useState('');
  const [manual, setManual] = useState('');
  const [manualState, setManualState] = useState<ManualState>('idle');
  const [manualInfo, setManualInfo] = useState<ManualRuntimeInfo | null>(null);
  const [applying, setApplying] = useState(false);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  /** 默认选中项：当前使用项优先，其次检测到的最低版本。 */
  const defaultPick = useCallback(
    (list: JdkCandidate[], current: string): string => {
      const match = list.find((item) => item.path === current);
      const lowest = list.reduce<JdkCandidate | null>(
        (min, item) => (min === null || item.version < min.version ? item : min),
        null,
      );
      return match ? match.path : lowest ? lowest.path : '';
    },
    [],
  );

  const detect = useCallback(async () => {
    setDetecting(true);
    try {
      // 检测接口常在瞬间返回；「检测中 → 结果」固定保留 400ms 过渡，让状态变化可感知。
      const [result] = await Promise.all([
        DetectJavaRuntimes(),
        new Promise((resolve) => setTimeout(resolve, DETECT_MIN_DURATION_MS)),
      ]);
      const list = result.success
        ? (result.data as { candidates?: JdkCandidate[] } | null | undefined)?.candidates ?? []
        : [];
      setCandidates(list);
      setPicked(defaultPick(list, currentPath));
      setDetectedAt(clockNow());
    } catch {
      setCandidates([]);
      setPicked('');
    } finally {
      setDetecting(false);
    }
  }, [currentPath, defaultPick]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPicked('');
    setManual('');
    setManualState('idle');
    setManualInfo(null);
    void detect();
  }, [open, detect]);

  /** 目录 / 完整路径 → java.exe；解析不到返回 null。 */
  const resolveJdkPath = async (raw: string): Promise<string | null> => {
    const value = raw.trim().replace(/^"|"$/g, '');
    if (!value) {
      return null;
    }
    if (/\.exe$/i.test(value)) {
      return (await fileExists(value)) ? value : null;
    }
    for (const candidate of [`${value}\\bin\\java.exe`, `${value}\\java.exe`]) {
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  // 手动输入防抖校验：结果只影响反馈与选中态归属，不阻断提交（提交时仍会再解析一次）。
  const manualRef = useRef(manual);
  manualRef.current = manual;
  useEffect(() => {
    const value = manual.trim();
    if (!value) {
      setManualState('idle');
      setManualInfo(null);
      return undefined;
    }
    setManualState('checking');
    const timer = window.setTimeout(() => {
      void resolveJdkPath(value).then((resolved) => {
        // 输入已变化时丢弃过期结果。
        if (manualRef.current.trim() !== value) {
          return;
        }
        if (!resolved) {
          setManualState('bad');
          setManualInfo(null);
          return;
        }
        setManualState('ok');
        void DescribeJavaRuntime(resolved).then((info) => {
          if (manualRef.current.trim() !== value) {
            return;
          }
          const data = (info?.data ?? null) as { name?: string; version?: number } | null;
          setManualInfo(data && info?.success ? { name: data.name, version: data.version } : null);
        });
      });
    }, MANUAL_CHECK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // resolveJdkPath 每次渲染重建，这里只依赖 manual（值语义稳定）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual]);

  /** 手动路径生效：选中态转移到手动框，列表降权但仍可点回。 */
  const manualActive = manual.trim() !== '' && manualState === 'ok';

  const pickCandidate = (path: string) => {
    setPicked(path);
    setManual('');
    setManualState('idle');
    setManualInfo(null);
  };

  const clearManual = () => {
    setManual('');
    setManualState('idle');
    setManualInfo(null);
    setPicked(defaultPick(candidates, currentPath));
  };

  const copyPath = (path: string) => {
    void navigator.clipboard?.writeText(path);
    message.success(t('app.engine.message.copied'));
  };

  const browse = async () => {
    try {
      const result = await SelectDirectory(t('service.modal.jdk.pick'), '');
      const dir = typeof result.data === 'string' ? result.data.trim() : '';
      if (!dir) {
        return;
      }
      setApplying(true);
      const resolved = await resolveJdkPath(dir);
      if (!resolved) {
        message.error(t('service.modal.jdk.notFound'));
        setManualState('bad');
        setManualInfo(null);
        return;
      }
      setManual(resolved);
      setManualState('ok');
      setPicked('');
      void DescribeJavaRuntime(resolved).then((info) => {
        const data = (info?.data ?? null) as { name?: string; version?: number } | null;
        setManualInfo(info?.success && data ? { name: data.name, version: data.version } : null);
      });
    } catch {
      // 用户取消或运行时不可用时保持原样。
    } finally {
      setApplying(false);
    }
  };

  const apply = async () => {
    const raw = (manual.trim() || picked).trim();
    if (!raw) {
      return;
    }
    setApplying(true);
    try {
      // 候选项必然存在；手动路径（目录或完整路径）在提交前解析并校验
      if (!candidates.some((item) => item.path === raw)) {
        const resolved = await resolveJdkPath(raw);
        if (!resolved) {
          message.error(t('service.modal.jdk.notFound'));
          return;
        }
        onApply(resolved);
        onClose();
        return;
      }
      onApply(raw);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const canApply = !applying && (manualActive || picked !== '');

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && canApply && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      void apply();
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
      zIndex={zIndex}
      closable={false}
      maskClosable={false}
      wrapClassName="asm-jdk-modal-wrap"
      afterOpenChange={(next) => {
        if (!next) {
          onClosed?.();
        }
      }}
      styles={{ header: { display: 'none' }, body: { padding: 0 }, content: { padding: 0 } }}
    >
      <div className="asm-jdk" onKeyDown={handleKeyDown}>
        {/* 头部：图标 + 标题 + 说明 + 关闭 */}
        <div className="asm-jdk-head">
          <span className="asm-jdk-ico" aria-hidden="true">
            <CoffeeIcon />
          </span>
          <div className="asm-jdk-head-main">
            <h3>{t('service.modal.jdk.title')}</h3>
            <p>{renderRich(t('service.modal.jdk.desc'))}</p>
          </div>
          <button type="button" className="asm-jdk-x" title={t('common.close')} onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>

        <div className="asm-jdk-body">
          {/* 检测元信息 + 重新检测 */}
          <div className="asm-jdk-detect">
            <span className="asm-jdk-detect-hint">
              {!detecting && detectedAt ? (
                <>
                  {renderRich(t('service.modal.jdk.detected', { n: '{{n}}' }), { n: candidates.length })}
                  {' · '}
                  {renderRich(t('service.modal.jdk.lastCheck', { time: '{{time}}' }), { time: detectedAt })}
                </>
              ) : (
                t('service.modal.jdk.detecting')
              )}
            </span>
            <button
              type="button"
              className="asm-jdk-redetect"
              disabled={detecting}
              onClick={() => void detect()}
            >
              <SyncOutlined spin={detecting} />
              {t('service.modal.jdk.redetect')}
            </button>
          </div>

          {/* 候选项 / 骨架屏 / 空态 */}
          {detecting ? (
            <>
              <div className="asm-jdk-skeleton" aria-hidden="true">
                <span className="asm-jdk-skeleton-row" />
                <span className="asm-jdk-skeleton-row" />
                <span className="asm-jdk-skeleton-row" />
              </div>
              <div className="asm-jdk-scan">
                <span className="asm-jdk-spin" />
                {t('service.modal.jdk.scanning')}
              </div>
            </>
          ) : candidates.length > 0 ? (
            <div className={manualActive ? 'asm-jdk-list dim' : 'asm-jdk-list'}>
              {candidates.map((item) => {
                const active = !manualActive && picked === item.path;
                return (
                  <div
                    key={item.path}
                    role="button"
                    tabIndex={0}
                    className={active ? 'asm-jdk-item on' : 'asm-jdk-item'}
                    onClick={() => pickCandidate(item.path)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        pickCandidate(item.path);
                      }
                    }}
                  >
                    <span className="asm-jdk-radio" aria-hidden="true" />
                    <span className={`asm-jdk-ver v${item.version >= 17 ? '17' : '8'}`}>
                      {item.version || '·'}
                    </span>
                    <span className="asm-jdk-main">
                      <span className="asm-jdk-name">
                        {`Java ${item.version || '?'}`}
                        <span className="vendor">· {item.name}</span>
                        {item.path === currentPath ? (
                          <span className="asm-jdk-tag">{t('service.modal.jdk.current')}</span>
                        ) : null}
                      </span>
                      <span className="asm-jdk-path">
                        <span className="p">{item.path}</span>
                        <button
                          type="button"
                          className="asm-jdk-copy"
                          title={t('service.modal.jdk.copyPath')}
                          onClick={(event) => {
                            event.stopPropagation();
                            copyPath(item.path);
                          }}
                        >
                          <CopyOutlined />
                        </button>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="asm-jdk-empty">
              <div className="asm-jdk-empty-ico" aria-hidden="true">
                <SearchOutlined />
              </div>
              <div className="asm-jdk-empty-title">{t('service.modal.jdk.emptyTitle')}</div>
              <div className="asm-jdk-empty-sub">{t('service.modal.jdk.emptySub')}</div>
              <div className="asm-jdk-empty-actions">
                <Button type="primary" onClick={() => void detect()}>
                  {t('service.modal.jdk.redetect')}
                </Button>
                <Button onClick={() => manualInputRef.current?.focus()}>
                  {t('service.modal.jdk.manual')}
                </Button>
              </div>
            </div>
          )}

          {/* 手动指定：与列表互斥单选，校验通过后接管选中态 */}
          <div className="asm-jdk-or"><span>{t('service.modal.jdk.or')}</span></div>
          <div className="asm-jdk-manual-label">
            {t('service.modal.jdk.manual')}
            <span className="opt">{t('service.modal.jdk.manualOpt')}</span>
          </div>
          <div className="asm-jdk-manual">
            <div
              className={
                manualState === 'bad'
                  ? 'asm-jdk-manual-field bad'
                  : manualActive
                    ? 'asm-jdk-manual-field on'
                    : 'asm-jdk-manual-field'
              }
            >
              <span className="asm-jdk-radio" aria-hidden="true" />
              <FolderOutlined className="asm-jdk-manual-ico" />
              <input
                ref={manualInputRef}
                className="mono"
                value={manual}
                placeholder={t('service.modal.jdk.manualPlaceholder')}
                spellCheck={false}
                onChange={(event) => {
                  setManual(event.target.value);
                  setPicked('');
                }}
              />
              {manual ? (
                <button
                  type="button"
                  className="asm-jdk-manual-clear"
                  title={t('service.modal.jdk.clear')}
                  onClick={clearManual}
                >
                  <CloseOutlined />
                </button>
              ) : null}
            </div>
            <button type="button" className="asm-browse-btn" disabled={applying} onClick={() => void browse()}>
              <FolderOutlined />
              {t('service.modal.program.browse')}
            </button>
          </div>
          {manualState === 'ok' ? (
            <div className="asm-jdk-manual-ok">
              <CheckOutlined className="asm-jdk-line-ic" />
              <span>
                {t('service.modal.jdk.valid')}
                {manualInfo?.name ? (
                  <>
                    {' '}<b>{manualInfo.name}</b>
                    {manualInfo.version ? <span className="ok-pill">v{manualInfo.version}</span> : null}
                  </>
                ) : null}
              </span>
            </div>
          ) : manualState === 'bad' ? (
            <div className="asm-jdk-manual-bad">
              <ExclamationCircleFilled className="asm-jdk-line-ic" />
              <span>{t('service.modal.jdk.notFound')}</span>
            </div>
          ) : (
            <div className="asm-jdk-manual-help">
              <InfoCircleOutlined className="asm-jdk-line-ic" />
              <span>{renderRich(t('service.modal.jdk.manualHelp'))}</span>
            </div>
          )}
        </div>

        {/* 底栏：快捷键提示 + 单主按钮（Esc 取消由 Modal 承接） */}
        <div className="asm-jdk-foot">
          <div className="asm-jdk-foot-actions">
            <Button
              type="primary"
              disabled={!canApply}
              loading={applying}
              icon={<CheckOutlined />}
              onClick={() => void apply()}
            >
              {t('service.modal.jdk.apply')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
