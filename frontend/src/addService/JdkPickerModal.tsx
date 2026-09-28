import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, message } from 'antd';
import { CloseOutlined, FolderOutlined, SyncOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import { getDbIconAssetSrc } from '../components/DatabaseIcons';
import {
  DetectJavaRuntimes,
  ProbeWindowsService,
  SelectDirectory,
} from '../../wailsjs/go/app/App';
import './jdkPickerModal.css';

/** DetectJavaRuntimes 返回的一个本机 Java 运行时候选。 */
interface JdkCandidate {
  version: number;
  name: string;
  path: string;
}

/** 手动路径校验状态。 */
type ManualState = 'idle' | 'checking' | 'ok' | 'bad';

/** 手动输入校验防抖：避免每个字符都打一次后端探测。 */
const MANUAL_CHECK_DEBOUNCE_MS = 400;

/** 「检测中 → 结果」的最短过渡时长：接口常瞬间返回，固定保留 1s 让状态变化可感知。 */
const DETECT_MIN_DURATION_MS = 1000;

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
 * 「选择 JDK」弹窗（对齐高保真 design/jdk-picker-v1.html）：
 * 检测元信息 + 重新检测 / 候选项卡片列表 / 手动指定（与列表互斥单选，
 * 校验通过后选中态转移到手动框）/ 三态反馈（空态 · 检测中骨架屏 · 校验结果）。
 *
 * 检测、路径解析与提交逻辑保持原有口径，本轮只升级结构与反馈。
 */
export const JdkPickerModal: React.FC<{
  open: boolean;
  currentPath: string;
  zIndex?: number;
  onClose: () => void;
  onApply: (path: string) => void;
}> = ({ open, currentPath, zIndex, onClose, onApply }) => {
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<JdkCandidate[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectedAt, setDetectedAt] = useState('');
  const [picked, setPicked] = useState('');
  const [manual, setManual] = useState('');
  const [manualState, setManualState] = useState<ManualState>('idle');
  const [applying, setApplying] = useState(false);

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
      // 检测接口常在瞬间返回；「检测中 → 结果」固定保留 1s 过渡，让状态变化可感知。
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
      return undefined;
    }
    setManualState('checking');
    const timer = window.setTimeout(() => {
      void resolveJdkPath(value).then((resolved) => {
        // 输入已变化时丢弃过期结果。
        if (manualRef.current.trim() !== value) {
          return;
        }
        setManualState(resolved ? 'ok' : 'bad');
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
  };

  const clearManual = () => {
    setManual('');
    setManualState('idle');
    setPicked(defaultPick(candidates, currentPath));
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
        return;
      }
      setManual(resolved);
      setManualState('ok');
      setPicked('');
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
      styles={{ header: { display: 'none' }, body: { padding: 0 } }}
    >
      <div className="asm-jdk">
        {/* 头部：图标 + 标题 + 说明 + 关闭 */}
        <div className="asm-jdk-head">
          <span className="asm-jdk-ico" aria-hidden="true">
            <img src={getDbIconAssetSrc('java')} alt="" />
          </span>
          <div className="asm-jdk-head-main">
            <h3>{t('service.modal.jdk.title')}</h3>
            <p>{t('service.modal.jdk.desc')}</p>
          </div>
          <button type="button" className="asm-jdk-x" title={t('common.close')} onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>

        <div className="asm-jdk-body">
          {/* 检测元信息 + 重新检测 */}
          <div className="asm-jdk-detect">
            <span className="asm-jdk-detect-hint">
              {detecting
                ? t('service.modal.jdk.detecting')
                : t('service.modal.jdk.detected', { n: candidates.length })}
              {detectedAt && !detecting ? ` · ${detectedAt}` : ''}
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
            <div className="asm-jdk-skeleton" aria-hidden="true">
              <span className="asm-jdk-skeleton-row" />
              <span className="asm-jdk-skeleton-row" />
              <span className="asm-jdk-skeleton-row" />
            </div>
          ) : candidates.length > 0 ? (
            <div className={manualActive ? 'asm-jdk-list dim' : 'asm-jdk-list'}>
              {candidates.map((item) => {
                const active = !manualActive && picked === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={active ? 'asm-jdk-item on' : 'asm-jdk-item'}
                    onClick={() => pickCandidate(item.path)}
                  >
                    <span className={`asm-jdk-ver v${item.version >= 17 ? '17' : '8'}`}>
                      {item.version || '·'}
                    </span>
                    <span className="asm-jdk-main">
                      <span className="asm-jdk-name">
                        {`Java ${item.version || '?'} · ${item.name}`}
                        {item.path === currentPath ? (
                          <span className="asm-jdk-tag">{t('service.modal.jdk.current')}</span>
                        ) : null}
                      </span>
                      <span className="asm-jdk-path mono">{item.path}</span>
                    </span>
                    <span className="asm-jdk-radio" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="asm-jdk-empty">{t('service.modal.jdk.empty')}</div>
          )}

          {/* 手动指定：与列表互斥单选，校验通过后接管选中态 */}
          <div className="asm-jdk-or"><span>{t('service.modal.jdk.or')}</span></div>
          <div className="asm-jdk-manual-label">{t('service.modal.jdk.manual')}</div>
          <div className="asm-jdk-manual">
            <div className={manualActive ? 'asm-jdk-manual-field on' : 'asm-jdk-manual-field'}>
              <span className="asm-jdk-radio" aria-hidden="true" />
              <FolderOutlined className="asm-jdk-manual-ico" />
              <input
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
            <div className="asm-jdk-manual-ok">{t('service.modal.jdk.valid')}</div>
          ) : manualState === 'bad' ? (
            <div className="asm-jdk-manual-bad">{t('service.modal.jdk.notFound')}</div>
          ) : null}
        </div>

        {/* 底栏：单主按钮 */}
        <div className="asm-jdk-foot">
          <span className="asm-jdk-foot-hint">
            {detecting
              ? t('service.modal.jdk.detecting')
              : candidates.length > 0
                ? t('service.modal.jdk.detected', { n: candidates.length })
                : t('service.modal.jdk.empty')}
          </span>
          <div className="asm-jdk-foot-actions">
            <Button className="asm-btn-ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" disabled={!canApply} loading={applying} onClick={() => void apply()}>
              {t('service.modal.jdk.apply')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
