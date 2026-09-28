import React, { useEffect, useState } from 'react';
import { Button, Modal, message } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import {
  DetectJavaRuntimes,
  ProbeWindowsService,
  SelectDirectory,
} from '../../wailsjs/go/app/App';

/** DetectJavaRuntimes 返回的一个本机 Java 运行时候选。 */
interface JdkCandidate {
  version: number;
  name: string;
  path: string;
}

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

/**
 * 「选择 JDK」弹窗（对齐高保真）：自动检测的本机运行时候选列表 + 手动指定 + 浏览。
 * 手动指定接受 JDK 目录或 java.exe 完整路径：目录会解析到 bin\java.exe，
 * 解析不到时报错而不是带病提交。默认选中当前使用项；没有匹配时选检测到的最低版本。
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
  const [picked, setPicked] = useState('');
  const [manual, setManual] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPicked('');
    setManual('');
    setDetecting(true);
    DetectJavaRuntimes()
      .then((result) => {
        if (!result.success) {
          setCandidates([]);
          return;
        }
        const list =
          (result.data as { candidates?: JdkCandidate[] } | null | undefined)?.candidates ?? [];
        setCandidates(list);
        // 默认选中：当前使用项；没有匹配时取检测到的最低版本
        const match = list.find((item) => item.path === currentPath);
        const lowest = list.reduce<JdkCandidate | null>(
          (min, item) => (min === null || item.version < min.version ? item : min),
          null,
        );
        setPicked(match ? match.path : lowest ? lowest.path : '');
      })
      .catch(() => setCandidates([]))
      .finally(() => setDetecting(false));
  }, [open, currentPath]);

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
        return;
      }
      setManual(resolved);
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

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      zIndex={zIndex}
      closable={false}
      maskClosable={false}
      styles={{ header: { display: 'none' }, body: { padding: 0 } }}
    >
      <div className="asm-jdk">
        <div className="asm-jdk-head">
          <h3>{t('service.modal.jdk.title')}</h3>
          <p>{t('service.modal.jdk.desc')}</p>
        </div>
        <div className="asm-jdk-body">
          {detecting ? (
            <div className="asm-jdk-empty">{t('service.modal.jdk.detecting')}</div>
          ) : candidates.length > 0 ? (
            <div className="asm-jdk-list">
              {candidates.map((item) => {
                const active = picked === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={active ? 'asm-jdk-item on' : 'asm-jdk-item'}
                    onClick={() => {
                      setPicked(item.path);
                      setManual('');
                    }}
                  >
                    <span className="asm-jdk-radio" aria-hidden="true" />
                    <span className="asm-jdk-ver">{item.version || '·'}</span>
                    <span className="asm-jdk-main">
                      <span className="asm-jdk-name">
                        {`Java ${item.version || '?'} · ${item.name}`}
                        {item.path === currentPath ? (
                          <span className="asm-jdk-tag">{t('service.modal.jdk.current')}</span>
                        ) : null}
                      </span>
                      <span className="asm-jdk-path mono">{item.path}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="asm-jdk-empty">{t('service.modal.jdk.empty')}</div>
          )}
          <div className="asm-jdk-manual">
            <label>{t('service.modal.jdk.manual')}</label>
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
            <button type="button" className="asm-browse-btn" disabled={applying} onClick={() => void browse()}>
              <FolderOutlined />
              {t('service.modal.program.browse')}
            </button>
          </div>
        </div>
        <div className="asm-jdk-foot">
          <Button className="asm-btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" disabled={!applying && !(manual.trim() || picked)} loading={applying} onClick={() => void apply()}>
            {t('service.modal.jdk.apply')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
