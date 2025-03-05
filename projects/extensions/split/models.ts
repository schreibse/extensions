export type MtxSplitPaneSize = number | '*';

export type MtxSplitPaneSizeInput = MtxSplitPaneSize | `${number}` | undefined | null;

const internalPaneSizeTransform = (paneSize: MtxSplitPaneSizeInput): MtxSplitPaneSize =>
  paneSize === undefined || paneSize === null || paneSize === '*' ? '*' : +paneSize;

export const paneSizeTransform = (paneSize: MtxSplitPaneSizeInput): MtxSplitPaneSize | 'auto' =>
  internalPaneSizeTransform(paneSize);

export const boundaryPaneSizeTransform = (paneSize: MtxSplitPaneSizeInput): MtxSplitPaneSize =>
  internalPaneSizeTransform(paneSize);

export type MtxSplitDirection = 'horizontal' | 'vertical';

export type MtxSplitDir = 'ltr' | 'rtl';

export type MtxSplitUnit = 'pixel' | 'percent';

export interface MtxSplitGutterInteractionEvent {
  gutterNum: number;
  sizes: MtxSplitPaneSize[];
}
