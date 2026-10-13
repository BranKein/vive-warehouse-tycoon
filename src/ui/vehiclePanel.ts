import type { StockView, VehicleView } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setFill, setHidden, setText, type Row } from './dom';
import { formatAmount, formatStock, itemName, vehicleDestinationName, vehicleHomeName, vehicleKindName, vehicleStateName, vehicleStatus } from './text';

type CargoItem = Pick<StockView, 'item' | 'amount'>;

/**
 * The card for the selected vehicle, on the right edge under the top bar:
 * what it is, who it works for, where it is going and what it carries.
 * The 3D view follows the vehicle for as long as it is selected; closing the
 * card lets it go.
 */
export function createVehiclePanel(ctx: UIContext) {
  const { tr } = ctx;
  const title = h('div', 'wt-vehicle-title');
  const close = button('wt-icon-btn', () => ctx.select({ type: 'none' }), '×');
  const statusDot = h('span', 'wt-dot');
  const statusText = h('span', 'wt-status-text');

  const fact = (): { el: HTMLElement; label: HTMLElement; value: HTMLElement } => {
    const label = h('span', 'wt-vehicle-label');
    const value = h('span', 'wt-vehicle-value');
    return { el: h('div', 'wt-vehicle-fact', label, value), label, value };
  };
  const home = fact();
  const destination = fact();

  const loadLabel = h('span', 'wt-stock-name');
  const loadAmount = h('span', 'wt-stock-amount');
  const loadFill = h('div', 'wt-bar-fill');
  const load = h('div', 'wt-stock', h('div', 'wt-stock-head', loadLabel, loadAmount), h('div', 'wt-bar wt-bar-thin', loadFill));

  const cargoTitle = h('div', 'wt-section-title');
  const cargoBox = h('div', 'wt-vehicle-cargo');
  const cargo = new KeyedList<CargoItem>(
    cargoBox,
    (entry) => entry.item,
    (): Row<CargoItem> => {
      const name = h('span', 'wt-stock-name');
      const amount = h('span', 'wt-stock-amount');
      return {
        el: h('div', 'wt-stock-head', name, amount),
        update(entry) {
          setText(name, itemName(tr, entry.item));
          setText(amount, formatAmount(entry.amount));
        },
      };
    },
  );

  const el = h(
    'aside',
    'wt-vehicle wt-card',
    h('div', 'wt-vehicle-head', title, close),
    h('div', 'wt-status', statusDot, statusText),
    home.el,
    destination.el,
    load,
    cargoTitle,
    cargoBox,
  );
  el.hidden = true;

  function show(vehicle: VehicleView, frame: Frame): void {
    const island = frame.snapshot.island;
    setText(title, vehicleKindName(tr, vehicle.kind));
    setAttr(close, 'title', tr.t('common.close'));
    setAttr(close, 'aria-label', tr.t('common.close'));
    setAttr(statusDot, 'data-status', vehicleStatus(vehicle.state));
    setText(statusText, vehicleStateName(tr, vehicle.state));

    const homeName = vehicleHomeName(tr, island, vehicle);
    setHidden(home.el, homeName === null);
    setText(home.label, tr.t('vehicle.home'));
    setText(home.value, homeName ?? '');

    // A carrier with no stop ahead that is still moving is on its way home.
    const destinationName = vehicleDestinationName(tr, island, vehicle);
    const returning = vehicle.kind === 'carrier' && destinationName === null && vehicle.state === 'moving';
    setHidden(destination.el, destinationName === null && !returning);
    setText(destination.label, tr.t('vehicle.destination'));
    setText(destination.value, destinationName ?? tr.t('vehicle.returning'));

    setText(loadLabel, tr.t('vehicle.load'));
    const carried = vehicle.cargo.reduce((sum, entry) => sum.add(entry.amount), BigNum.ZERO);
    setText(loadAmount, formatStock(tr, carried, vehicle.capacity));
    setFill(loadFill, vehicle.loadRatio);

    setText(cargoTitle, vehicle.cargo.length === 0 ? tr.t('vehicle.empty') : tr.t('vehicle.cargo'));
    cargo.sync(vehicle.cargo);
  }

  return {
    el,
    update(frame: Frame): void {
      const selection = frame.selection;
      const vehicle =
        selection.type === 'vehicle' ? frame.snapshot.island.vehicles.find((entry) => entry.id === selection.vehicleId) : undefined;
      setHidden(el, vehicle === undefined);
      if (vehicle) show(vehicle, frame);
    },
  };
}
