import React, { useEffect, useState } from 'react';
import { Settings, Shield, Server, Clock, Container } from 'lucide-react';
import { useLang } from '../i18n';
import { api } from '../services/api';

type MetaInfo = {
  version: string;
  authRequired: boolean;
  webhookKeep: number;
  webhookTtlDays: number;
  node?: string;
  platform?: string;
};

export const SettingsView: React.FC = () => {
  const { t } = useLang();
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getMeta()
      .then((data) => {
        if (!cancelled && data) setMeta(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const version = (meta?.version || '').slice(0);
  const node = (meta?.node || '').slice(0);
  const platform = (meta?.platform || '').slice(0);
  const authLabel = meta
    ? (meta.authRequired ? t('meta.auth_on') : t('meta.auth_off'))
    : '—';
  const retention = meta
    ? t('meta.retention')
        .replace('{keep}', String(meta.webhookKeep ?? ''))
        .replace('{days}', String(meta.webhookTtlDays ?? ''))
    : '—';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">{t('settings.title')}</h3>
            <p className="text-xs text-slate-400">{t('settings.subtitle')}</p>
          </div>
        </div>
        {loading && !meta && (
          <div className="text-xs text-slate-500 font-mono">{t('common.loading')}</div>
        )}
        {meta && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{t('settings.version')}</div>
              <div className="text-sm font-mono text-slate-200">{`v${version || '—'}`}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {t('settings.auth')}
              </div>
              <div className="text-sm font-mono text-slate-200">{(authLabel || '').slice(0)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('settings.retention')}
              </div>
              <div className="text-sm font-mono text-slate-200 break-all">{(retention || '').slice(0)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1">
                <Server className="w-3 h-3" />
                {t('settings.runtime')}
              </div>
              <div className="text-sm font-mono text-slate-200 break-all">
                {(node || '—').slice(0)} · {(platform || '—').slice(0)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('settings.howto_title')}</h4>
        <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
          <li>{t('settings.token_hint')}</li>
          <li className="lg:hidden">{t('settings.token_mobile_hint')}</li>
          <li>{t('settings.env_token_hint')}</li>
          <li>{t('settings.retention_readonly')}</li>
        </ul>
      </div>

      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Container className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('settings.security_title')}</h4>
        </div>
        <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
          <li>{t('settings.security_token')}</li>
          <li>{t('settings.docker_bind')}</li>
          <li>{t('settings.docker_harden')}</li>
          <li>{t('settings.security_retention')}</li>
        </ul>
        <p className="text-[11px] text-slate-500 leading-relaxed">{t('settings.security_disclaimer')}</p>
      </div>
    </div>
  );
};
