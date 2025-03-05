import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Signal,
  booleanAttribute,
  computed,
  inject,
  input,
  isDevMode,
  linkedSignal,
} from '@angular/core';
import { MTX_SPLIT_PANE_CONTRACT, MtxSplitComponent } from '../split/split.component';
import { createClassesString } from '../utils';
import { MtxSplitPaneSize, paneSizeTransform, boundaryPaneSizeTransform } from '../models';

@Component({
  selector: 'mtx-split-pane, [mtx-split-pane]',
  exportAs: 'mtxSplitPane',
  standalone: true,
  templateUrl: './split-pane.component.html',
  styleUrl: './split-pane.component.scss',
  providers: [
    {
      provide: MTX_SPLIT_PANE_CONTRACT,
      useExisting: MtxSplitPaneComponent,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MtxSplitPaneComponent {
  protected readonly split = inject(MtxSplitComponent);

  readonly size = input('auto', { transform: paneSizeTransform });
  readonly minSize = input('*', { transform: boundaryPaneSizeTransform });
  readonly maxSize = input('*', { transform: boundaryPaneSizeTransform });
  readonly lockSize = input(false, { transform: booleanAttribute });
  readonly visible = input(true, { transform: booleanAttribute });

  /**
   * @internal
   */
  readonly _internalSize = linkedSignal((): MtxSplitPaneSize => {
    if (!this.visible()) {
      return 0;
    }

    const visibleIndex = this.split._visiblePanes().findIndex(pane => pane === this);

    return this.split._alignedVisiblePanesSizes()[visibleIndex];
  });
  /**
   * @internal
   */
  readonly _normalizedMinSize = computed(() => this.normalizeMinSize());
  /**
   * @internal
   */
  readonly _normalizedMaxSize = computed(() => this.normalizeMaxSize());
  private readonly index = computed(() => this.split._panes().findIndex(pane => pane === this));
  private readonly gridPaneNum = computed(() => this.index() * 2 + 1);
  private readonly hostClasses = computed(() =>
    createClassesString({
      ['mtx-split-pane']: true,
      ['as-min']: this.visible() && this._internalSize() === this._normalizedMinSize(),
      ['as-max']: this.visible() && this._internalSize() === this._normalizedMaxSize(),
      ['as-hidden']: !this.visible(),
    })
  );

  @HostBinding('class') protected get hostClassesBinding() {
    return this.hostClasses();
  }
  @HostBinding('style.grid-column') protected get hostGridColumnStyleBinding() {
    return this.split.direction() === 'horizontal'
      ? `${this.gridPaneNum()} / ${this.gridPaneNum()}`
      : undefined;
  }
  @HostBinding('style.grid-row') protected get hostGridRowStyleBinding() {
    return this.split.direction() === 'vertical'
      ? `${this.gridPaneNum()} / ${this.gridPaneNum()}`
      : undefined;
  }
  @HostBinding('style.position') protected get hostPositionStyleBinding() {
    return this.split._isDragging() ? 'relative' : undefined;
  }

  private normalizeMinSize() {
    const defaultMinSize = 0;

    if (!this.visible()) {
      return defaultMinSize;
    }

    const minSize = this.normalizeSizeBoundary(this.minSize, defaultMinSize);
    const size = this.size();

    if (size !== '*' && size !== 'auto' && size < minSize) {
      if (isDevMode()) {
        console.warn('mtx-split: size cannot be smaller than minSize');
      }

      return defaultMinSize;
    }

    return minSize;
  }

  private normalizeMaxSize() {
    const defaultMaxSize = Infinity;

    if (!this.visible()) {
      return defaultMaxSize;
    }

    const maxSize = this.normalizeSizeBoundary(this.maxSize, defaultMaxSize);
    const size = this.size();

    if (size !== '*' && size !== 'auto' && size > maxSize) {
      if (isDevMode()) {
        console.warn('mtx-split: size cannot be larger than maxSize');
      }

      return defaultMaxSize;
    }

    return maxSize;
  }

  private normalizeSizeBoundary(
    sizeBoundarySignal: Signal<MtxSplitPaneSize>,
    defaultBoundarySize: number
  ): number {
    const size = this.size();
    const lockSize = this.lockSize();
    const boundarySize = sizeBoundarySignal();

    if (lockSize) {
      if (isDevMode() && boundarySize !== '*') {
        console.warn('mtx-split: lockSize overwrites maxSize/minSize');
      }

      if (size === '*' || size === 'auto') {
        if (isDevMode()) {
          console.warn(`mtx-split: lockSize isn't supported on pane with * size or without size`);
        }

        return defaultBoundarySize;
      }

      return size;
    }

    if (boundarySize === '*') {
      return defaultBoundarySize;
    }

    if (size === '*' || size === 'auto') {
      if (isDevMode()) {
        console.warn('mtx-split: maxSize/minSize not allowed on * or without size');
      }

      return defaultBoundarySize;
    }

    return boundarySize;
  }
}
