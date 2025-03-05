import { MtxSplitPaneSize, MtxSplitUnit } from './models';
import { MtxSplitPaneComponent } from './split-pane/split-pane.component';
import { sum } from './utils';

export function arePanesValid(
  panes: readonly MtxSplitPaneComponent[],
  unit: MtxSplitUnit,
  logWarnings: boolean
): boolean {
  if (panes.length === 0) {
    return true;
  }

  const paneSizes = panes.map((pane): MtxSplitPaneSize => {
    const size = pane.size();
    return size === 'auto' ? '*' : size;
  });

  const wildcardPanes = paneSizes.filter(paneSize => paneSize === '*');

  if (wildcardPanes.length > 1) {
    if (logWarnings) {
      console.warn('mtx-split: Maximum one * pane is allowed');
    }

    return false;
  }

  if (unit === 'pixel') {
    if (wildcardPanes.length === 1) {
      return true;
    }

    if (logWarnings) {
      console.warn('mtx-split: Pixel mode must have exactly one * pane');
    }

    return false;
  }

  const sumPercent = sum(paneSizes, paneSize => (paneSize === '*' ? 0 : paneSize));

  // As percent calculation isn't perfect we allow for a small margin of error
  if (wildcardPanes.length === 1) {
    if (sumPercent <= 100.1) {
      return true;
    }

    if (logWarnings) {
      console.warn(`mtx-split: Percent panes must total 100%`);
    }

    return false;
  }

  if (sumPercent < 99.9 || sumPercent > 100.1) {
    if (logWarnings) {
      console.warn('mtx-split: Percent panes must total 100%');
    }

    return false;
  }

  return true;
}
