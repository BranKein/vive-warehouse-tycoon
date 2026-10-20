import type { CloudController, CloudProviderId, CloudStatus } from '@/contracts';
import { getLanguage, type TranslationKey } from '@/i18n';
import type { UIContext } from './context';
import { button, createConfirm, h, setAttr, setDisabled, setHidden, setText } from './dom';
import { formatSaveDate } from './saveMenu';
import { formatSaveSummary } from './text';

const PROVIDER_NAME = {
  google: 'cloud.provider.google',
  apple: 'cloud.provider.apple',
} as const satisfies Record<CloudProviderId, TranslationKey>;

const CONNECT_LABEL = {
  google: 'cloud.connect.google',
  apple: 'cloud.connect.apple',
} as const satisfies Record<CloudProviderId, TranslationKey>;

export const PRIVACY_URL = '/privacy.html';

/**
 * The cloud part of the save menu: connect buttons, the connection state, and the offer of another device's save.
 * It only talks to `CloudController`, so it does not change when another provider is added.
 */
export function createCloudSection(ctx: UIContext, cloud: CloudController, onLoaded: () => void) {
  const { tr } = ctx;
  let busy = false;
  let disposed = false;

  const title = h('div', 'wt-section-title');

  // A newer save from another device.
  const offerTitle = h('div', 'wt-cloud-offer-title');
  const offerDate = h('div', 'wt-save-date');
  const offerSummary = h('div', 'wt-save-summary');
  const offerHint = h('div', 'wt-save-summary');
  const localTitle = h('div', 'wt-save-date');
  const localSummary = h('div', 'wt-save-summary');
  const offerLoad = button('wt-btn wt-btn-primary', () =>
    run(async () => {
      const ok = await cloud.acceptOffer();
      ctx.notify(ok ? 'good' : 'error', () => tr.t(ok ? 'cloud.loaded' : 'save.loadFailed'));
      if (ok) onLoaded();
    }),
  );
  const offerKeep = button('wt-btn', () => run(() => cloud.dismissOffer()));
  const offer = h(
    'div',
    'wt-cloud-offer',
    offerTitle,
    offerDate,
    offerSummary,
    localTitle,
    localSummary,
    h('div', 'wt-menu-actions', offerLoad, offerKeep),
    offerHint,
  );

  const statusLine = h('p', 'wt-hint');
  const connectBox = h('div', 'wt-menu-actions');
  const connectButtons = cloud.providers().map((id) => {
    const el = button('wt-btn wt-btn-primary', () => connect(id));
    connectBox.append(el);
    return { id, el };
  });
  const reconnect = button('wt-btn wt-btn-primary', () => {
    const id = cloud.status().provider;
    if (id) connect(id);
  });
  const syncNow = button('wt-btn', () =>
    run(async () => {
      await cloud.syncNow();
      if (cloud.status().state === 'connected') ctx.notify('good', () => tr.t('cloud.synced'));
    }),
  );
  const loadCloud = createConfirm('wt-btn-quiet', () =>
    run(async () => {
      const ok = await cloud.loadFromCloud();
      ctx.notify(ok ? 'good' : 'info', () => tr.t(ok ? 'cloud.loaded' : 'cloud.nothing'));
      if (ok) onLoaded();
    }),
  );
  const disconnect = createConfirm('wt-btn-quiet', () => run(() => cloud.disconnect()));
  const connectedBox = h('div', 'wt-menu-actions', reconnect, syncNow);
  const manageBox = h('div', 'wt-cloud-manage', loadCloud.el, disconnect.el);
  const privacy = h('a', 'wt-cloud-privacy');
  privacy.href = PRIVACY_URL;
  privacy.target = '_blank';
  privacy.rel = 'noopener';

  const el = h('div', 'wt-cloud', title, offer, statusLine, connectBox, connectedBox, manageBox, privacy);

  /** Connecting opens a popup, so `cloud.connect` runs inside the click before anything is awaited. */
  function connect(id: CloudProviderId): void {
    void run(async () => {
      const ok = await cloud.connect(id);
      if (ok) ctx.notify('good', () => tr.t('cloud.connectedToast', { provider: tr.t(PROVIDER_NAME[id]) }));
    }, 'cloud.connectFailed');
  }

  async function run(work: () => Promise<void>, failure: TranslationKey = 'cloud.failed'): Promise<void> {
    if (busy) return;
    busy = true;
    // The work starts before the re-render, so a sign-in popup still opens inside the click.
    const task = work();
    render();
    try {
      await task;
    } catch (error) {
      console.error(error);
      // A sign-in that ran out is explained by the status line and its "connect again" button.
      if (!disposed && cloud.status().state !== 'expired') ctx.notify('error', () => tr.t(failure));
    }
    busy = false;
    if (!disposed) render();
  }

  function statusText(status: CloudStatus): string {
    const provider = status.provider ? tr.t(PROVIDER_NAME[status.provider]) : '';
    switch (status.state) {
      case 'off':
        return tr.t('cloud.offHint');
      case 'connecting':
        return tr.t('cloud.connecting');
      case 'syncing':
        return tr.t('cloud.syncing', { provider });
      case 'expired':
        return tr.t('cloud.expired', { provider });
      case 'error':
        return tr.t('cloud.error', { provider });
      case 'connected':
        return status.lastSyncedAt === null
          ? tr.t('cloud.connected', { provider })
          : tr.t('cloud.lastSynced', { provider, time: formatSaveDate(status.lastSyncedAt, getLanguage()) });
    }
  }

  function render(): void {
    const status = cloud.status();
    const linked = status.provider !== null && status.state !== 'off' && status.state !== 'connecting';
    setText(title, tr.t('cloud.title'));

    setHidden(offer, status.offer === null);
    if (status.offer) {
      setText(offerTitle, tr.t(status.offer.newer ? 'cloud.offerTitle' : 'cloud.offerTitleOther'));
      setText(offerDate, tr.t('cloud.offerFrom', { time: formatSaveDate(status.offer.savedAt, getLanguage()), device: status.offer.device || '?' }));
      setText(offerSummary, formatSaveSummary(tr, status.offer.summary));
      setText(localTitle, tr.t('cloud.offerThisDevice'));
      setText(localSummary, formatSaveSummary(tr, status.offer.local));
      setText(offerHint, tr.t('cloud.offerKeepHint'));
      setText(offerLoad, tr.t('cloud.offerLoad'));
      setText(offerKeep, tr.t('cloud.offerKeep'));
    }
    setDisabled(offerLoad, busy);
    setDisabled(offerKeep, busy);

    setText(statusLine, statusText(status));
    statusLine.classList.toggle('is-ready', status.state === 'connected');

    setHidden(connectBox, linked);
    for (const { id, el: connectButton } of connectButtons) {
      setText(connectButton, tr.t(CONNECT_LABEL[id]));
      setDisabled(connectButton, busy || status.state === 'connecting');
    }

    setHidden(connectedBox, !linked);
    setHidden(reconnect, status.state !== 'expired');
    setText(reconnect, tr.t('cloud.reconnect'));
    setDisabled(reconnect, busy);
    setHidden(syncNow, status.state === 'expired');
    setText(syncNow, status.state === 'error' ? tr.t('cloud.retry') : tr.t('cloud.syncNow'));
    setDisabled(syncNow, busy || status.state === 'syncing' || status.offer !== null);

    setHidden(manageBox, !linked);
    loadCloud.render({
      label: tr.t('cloud.load'),
      question: tr.t('cloud.loadConfirm'),
      yes: tr.t('common.confirm'),
      no: tr.t('common.cancel'),
      disabled: busy || status.state !== 'connected',
    });
    disconnect.render({
      label: tr.t('cloud.disconnect'),
      question: tr.t('cloud.disconnectConfirm'),
      yes: tr.t('common.confirm'),
      no: tr.t('common.cancel'),
      disabled: busy,
    });

    setText(privacy, tr.t('cloud.privacy'));
    setAttr(privacy, 'aria-label', tr.t('cloud.privacy'));
  }

  const stop = cloud.onChange(() => {
    if (!disposed) render();
  });
  render();

  return {
    el,
    render,
    /** The menu opened: the sign-in script loads now so the connect click can open its popup at once. */
    opened(): void {
      cloud.prepare();
      render();
    },
    disarm(): void {
      loadCloud.disarm();
      disconnect.disarm();
    },
    dispose(): void {
      disposed = true;
      stop();
    },
  };
}
