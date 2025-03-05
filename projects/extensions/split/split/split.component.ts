import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  InjectionToken,
  NgZone,
  Renderer2,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  isDevMode,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemePalette } from '@angular/material/core';
import type { MtxSplitPaneComponent } from '../split-pane/split-pane.component';
import {
  Subject,
  filter,
  fromEvent,
  map,
  pairwise,
  skipWhile,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import {
  ClientPoint,
  createClassesString,
  gutterEventsEqualWithDelta,
  fromMouseMoveEvent,
  fromMouseUpEvent,
  getPointFromEvent,
  leaveNgZone,
  numberAttributeWithFallback,
  sum,
  toRecord,
  assertUnreachable,
} from '../utils';
import { DOCUMENT, NgStyle, NgTemplateOutlet } from '@angular/common';
import { MtxSplitGutterInteractionEvent, MtxSplitPaneSize } from '../models';
import { MtxSplitCustomEventsBehaviorDirective } from '../split-custom-events-behavior.directive';
import { arePanesValid } from '../validations';
import { MtxSplitGutterDirective } from '../gutter/split-gutter.directive';
import { MtxSplitGutterDynamicInjectorDirective } from '../gutter/split-gutter-dynamic-injector.directive';
import { MTX_SPLIT_DEFAULT_OPTIONS } from '../split-config.token';

interface MouseDownContext {
  mouseDownEvent: MouseEvent | TouchEvent;
  gutterIndex: number;
  gutterElement: HTMLElement;
  paneBeforeGutterIndex: number;
  paneAfterGutterIndex: number;
}

interface PaneBoundary {
  min: number;
  max: number;
}

interface DragStartContext {
  startEvent: MouseEvent | TouchEvent | KeyboardEvent;
  panesPixelSizes: number[];
  totalPanesPixelSize: number;
  paneIndexToBoundaries: Record<number, PaneBoundary>;
  paneBeforeGutterIndex: number;
  paneAfterGutterIndex: number;
}

export const MTX_SPLIT_PANE_CONTRACT = new InjectionToken<MtxSplitPaneComponent>(
  'Mtx Split Pane Contract'
);

@Component({
  selector: 'mtx-split',
  imports: [
    NgStyle,
    MtxSplitCustomEventsBehaviorDirective,
    MtxSplitGutterDynamicInjectorDirective,
    NgTemplateOutlet,
  ],
  exportAs: 'mtxSplit',
  templateUrl: './split.component.html',
  styleUrl: './split.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MtxSplitComponent {
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngZone = inject(NgZone);
  private readonly defaultOptions = inject(MTX_SPLIT_DEFAULT_OPTIONS);

  private readonly gutterMouseDownSubject = new Subject<MouseDownContext>();
  private readonly dragProgressSubject = new Subject<MtxSplitGutterInteractionEvent>();

  /**
   * @internal
   */
  readonly _panes = contentChildren(MTX_SPLIT_PANE_CONTRACT);
  protected readonly customGutter = contentChild(MtxSplitGutterDirective);
  readonly gutterSize = input(this.defaultOptions.gutterSize, {
    transform: numberAttributeWithFallback(this.defaultOptions.gutterSize),
  });
  readonly gutterStep = input(this.defaultOptions.gutterStep, {
    transform: numberAttributeWithFallback(this.defaultOptions.gutterStep),
  });
  readonly color = input<ThemePalette>();
  readonly disabled = input(this.defaultOptions.disabled, { transform: booleanAttribute });
  readonly gutterClickDeltaPx = input(this.defaultOptions.gutterClickDeltaPx, {
    transform: numberAttributeWithFallback(this.defaultOptions.gutterClickDeltaPx),
  });
  readonly direction = input(this.defaultOptions.direction);
  readonly dir = input(this.defaultOptions.dir);
  readonly unit = input(this.defaultOptions.unit);
  readonly gutterAriaLabel = input<string>();
  readonly restrictMove = input(this.defaultOptions.restrictMove, { transform: booleanAttribute });
  readonly useTransition = input(this.defaultOptions.useTransition, {
    transform: booleanAttribute,
  });
  readonly gutterDblClickDuration = input(this.defaultOptions.gutterDblClickDuration, {
    transform: numberAttributeWithFallback(this.defaultOptions.gutterDblClickDuration),
  });
  readonly gutterClick = output<MtxSplitGutterInteractionEvent>();
  readonly gutterDblClick = output<MtxSplitGutterInteractionEvent>();
  readonly dragStart = output<MtxSplitGutterInteractionEvent>();
  readonly dragEnd = output<MtxSplitGutterInteractionEvent>();
  readonly transitionEnd = output<MtxSplitPaneSize[]>();

  readonly dragProgress$ = this.dragProgressSubject.asObservable();

  /**
   * @internal
   */
  readonly _visiblePanes = computed(() => this._panes().filter(pane => pane.visible()));
  private readonly gridTemplateColumnsStyle = computed(() => this.createGridTemplateColumnsStyle());
  private readonly hostClasses = computed(() =>
    createClassesString({
      [`as-${this.direction()}`]: true,
      [`as-${this.unit()}`]: true,
      ['as-disabled']: this.disabled(),
      ['as-dragging']: this._isDragging(),
      ['as-transition']: this.useTransition() && !this._isDragging(),
    })
  );
  protected readonly draggedGutterIndex = signal<number | undefined>(undefined);
  /**
   * @internal
   */
  readonly _isDragging = computed(() => this.draggedGutterIndex() !== undefined);
  /**
   * @internal
   * Should only be used by {@link MtxSplitPaneComponent._internalSize}
   */
  readonly _alignedVisiblePanesSizes = computed(() => this.createAlignedVisiblePanesSize());

  @HostBinding('class') protected get hostClassesBinding() {
    return this.hostClasses();
  }

  @HostBinding('dir') protected get hostDirBinding() {
    return this.dir();
  }

  constructor() {
    if (isDevMode()) {
      // Logs warnings to console when the provided panes sizes are invalid
      effect(() => {
        // Special mode when no size input was declared which is a valid mode
        if (
          this.unit() === 'percent' &&
          this._visiblePanes().every(pane => pane.size() === 'auto')
        ) {
          return;
        }

        arePanesValid(this._visiblePanes(), this.unit(), true);
      });
    }

    // Responsible for updating grid template style. Must be this way and not based on HostBinding
    // as change detection for host binding is bound to the parent component and this style
    // is updated on every mouse move. Doing it this way will prevent change detection cycles in parent.
    effect(() => {
      const gridTemplateColumnsStyle = this.gridTemplateColumnsStyle();
      this.renderer.setStyle(
        this.elementRef.nativeElement,
        'grid-template',
        gridTemplateColumnsStyle
      );
    });

    this.gutterMouseDownSubject
      .pipe(
        filter(context => {
          const customGutter = this.customGutter();
          return (
            !customGutter ||
            customGutter._canStartDragging(
              context.mouseDownEvent.target as HTMLElement,
              context.gutterIndex + 1
            )
          );
        }),
        switchMap(mouseDownContext =>
          // As we have gutterClickDeltaPx we can't just start the drag but need to make sure
          // we are out of the delta pixels. As the delta can be any number we make sure
          // we always start the drag if we go out of the gutter (delta based on mouse position is larger than gutter).
          // As moving can start inside the drag and end outside of it we always keep track of the previous event
          // so once the current is out of the delta size we use the previous one as the drag start baseline.
          fromMouseMoveEvent(this.document).pipe(
            startWith(mouseDownContext.mouseDownEvent),
            pairwise(),
            skipWhile(([, currMoveEvent]) =>
              gutterEventsEqualWithDelta(
                mouseDownContext.mouseDownEvent,
                currMoveEvent,
                this.gutterClickDeltaPx(),
                mouseDownContext.gutterElement
              )
            ),
            take(1),
            takeUntil(fromMouseUpEvent(this.document, true)),
            tap(() => {
              this.ngZone.run(() => {
                this.dragStart.emit(this.createDragInteractionEvent(mouseDownContext.gutterIndex));
                this.draggedGutterIndex.set(mouseDownContext.gutterIndex);
              });
            }),
            map(([prevMouseEvent]) =>
              this.createDragStartContext(
                prevMouseEvent,
                mouseDownContext.paneBeforeGutterIndex,
                mouseDownContext.paneAfterGutterIndex
              )
            ),
            switchMap(dragStartContext =>
              fromMouseMoveEvent(this.document).pipe(
                tap(moveEvent => this.mouseDragMove(moveEvent, dragStartContext)),
                takeUntil(fromMouseUpEvent(this.document, true)),
                tap({
                  complete: () =>
                    this.ngZone.run(() => {
                      this.dragEnd.emit(
                        this.createDragInteractionEvent(this.draggedGutterIndex()!)
                      );
                      this.draggedGutterIndex.set(undefined);
                    }),
                })
              )
            )
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe();

    fromEvent<TransitionEvent>(this.elementRef.nativeElement, 'transitionend')
      .pipe(
        filter(e => e.propertyName.startsWith('grid-template')),
        leaveNgZone(),
        takeUntilDestroyed()
      )
      .subscribe(() => this.ngZone.run(() => this.transitionEnd.emit(this.createPaneSizes())));
  }

  protected gutterClicked(gutterIndex: number) {
    this.ngZone.run(() => this.gutterClick.emit(this.createDragInteractionEvent(gutterIndex)));
  }

  protected gutterDoubleClicked(gutterIndex: number) {
    this.ngZone.run(() => this.gutterDblClick.emit(this.createDragInteractionEvent(gutterIndex)));
  }

  protected gutterMouseDown(
    e: MouseEvent | TouchEvent,
    gutterElement: HTMLElement,
    gutterIndex: number,
    paneBeforeGutterIndex: number,
    paneAfterGutterIndex: number
  ) {
    if (this.disabled()) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.gutterMouseDownSubject.next({
      mouseDownEvent: e,
      gutterElement,
      gutterIndex,
      paneBeforeGutterIndex,
      paneAfterGutterIndex,
    });
  }

  protected gutterKeyDown(
    e: KeyboardEvent,
    gutterIndex: number,
    paneBeforeGutterIndex: number,
    paneAfterGutterIndex: number
  ) {
    if (this.disabled()) {
      return;
    }

    const pixelsToMove = 50;
    const pageMoveMultiplier = 10;

    let xPointOffset = 0;
    let yPointOffset = 0;

    if (this.direction() === 'horizontal') {
      // Even though we are going in the x axis we support page up and down
      switch (e.key) {
        case 'ArrowLeft':
          xPointOffset -= pixelsToMove;
          break;
        case 'ArrowRight':
          xPointOffset += pixelsToMove;
          break;
        case 'PageUp':
          if (this.dir() === 'rtl') {
            xPointOffset -= pixelsToMove * pageMoveMultiplier;
          } else {
            xPointOffset += pixelsToMove * pageMoveMultiplier;
          }
          break;
        case 'PageDown':
          if (this.dir() === 'rtl') {
            xPointOffset += pixelsToMove * pageMoveMultiplier;
          } else {
            xPointOffset -= pixelsToMove * pageMoveMultiplier;
          }
          break;
        default:
          return;
      }
    } else {
      switch (e.key) {
        case 'ArrowUp':
          yPointOffset -= pixelsToMove;
          break;
        case 'ArrowDown':
          yPointOffset += pixelsToMove;
          break;
        case 'PageUp':
          yPointOffset -= pixelsToMove * pageMoveMultiplier;
          break;
        case 'PageDown':
          yPointOffset += pixelsToMove * pageMoveMultiplier;
          break;
        default:
          return;
      }
    }

    e.preventDefault();
    e.stopPropagation();

    const gutterMidPoint = getPointFromEvent(e);
    const dragStartContext = this.createDragStartContext(
      e,
      paneBeforeGutterIndex,
      paneAfterGutterIndex
    );

    this.ngZone.run(() => {
      this.dragStart.emit(this.createDragInteractionEvent(gutterIndex));
      this.draggedGutterIndex.set(gutterIndex);
    });

    if (gutterMidPoint) {
      this.dragMoveToPoint(
        { x: gutterMidPoint.x + xPointOffset, y: gutterMidPoint.y + yPointOffset },
        dragStartContext
      );
    }

    this.ngZone.run(() => {
      this.dragEnd.emit(this.createDragInteractionEvent(gutterIndex));
      this.draggedGutterIndex.set(undefined);
    });
  }

  protected getGutterGridStyle(nextPaneIndex: number) {
    const gutterNum = nextPaneIndex * 2;
    const style = `${gutterNum} / ${gutterNum}`;

    return {
      ['grid-column']: this.direction() === 'horizontal' ? style : '1',
      ['grid-row']: this.direction() === 'vertical' ? style : '1',
    };
  }

  protected getAriaPaneSizeText(pane: MtxSplitPaneComponent): string | undefined {
    const size = pane._internalSize();

    if (size === '*') {
      return undefined;
    }

    return `${size.toFixed(0)} ${this.unit()}`;
  }

  protected getAriaValue(size: MtxSplitPaneSize) {
    return size === '*' ? undefined : size;
  }

  private createDragInteractionEvent(gutterIndex: number): MtxSplitGutterInteractionEvent {
    return {
      gutterNum: gutterIndex + 1,
      sizes: this.createPaneSizes(),
    };
  }

  private createPaneSizes() {
    return this._visiblePanes().map(pane => pane._internalSize());
  }

  private createDragStartContext(
    startEvent: MouseEvent | TouchEvent | KeyboardEvent,
    paneBeforeGutterIndex: number,
    paneAfterGutterIndex: number
  ): DragStartContext {
    const splitBoundingRect = this.elementRef.nativeElement.getBoundingClientRect();
    const splitSize =
      this.direction() === 'horizontal' ? splitBoundingRect.width : splitBoundingRect.height;
    const totalPanesPixelSize = splitSize - (this._visiblePanes().length - 1) * this.gutterSize();
    // Use the internal size and split size to calculate the pixel size from wildcard and percent panes
    const panePixelSizesWithWildcard = this._panes().map(pane => {
      if (this.unit() === 'pixel') {
        return pane._internalSize();
      } else {
        const size = pane._internalSize();

        if (size === '*') {
          return size;
        }

        return (size / 100) * totalPanesPixelSize;
      }
    });
    const remainingSize = Math.max(
      0,
      totalPanesPixelSize - sum(panePixelSizesWithWildcard, size => (size === '*' ? 0 : size))
    );
    const panesPixelSizes = panePixelSizesWithWildcard.map(size =>
      size === '*' ? remainingSize : size
    );

    return {
      startEvent,
      paneBeforeGutterIndex,
      paneAfterGutterIndex,
      panesPixelSizes,
      totalPanesPixelSize,
      paneIndexToBoundaries: toRecord(this._panes(), (pane, index) => {
        const percentToPixels = (percent: number) => (percent / 100) * totalPanesPixelSize;

        const value: PaneBoundary =
          this.unit() === 'pixel'
            ? {
                min: pane._normalizedMinSize(),
                max: pane._normalizedMaxSize(),
              }
            : {
                min: percentToPixels(pane._normalizedMinSize()),
                max: percentToPixels(pane._normalizedMaxSize()),
              };

        return [index.toString(), value];
      }),
    };
  }

  private mouseDragMove(moveEvent: MouseEvent | TouchEvent, dragStartContext: DragStartContext) {
    moveEvent.preventDefault();
    moveEvent.stopPropagation();

    const endPoint = getPointFromEvent(moveEvent);
    if (endPoint !== undefined) {
      this.dragMoveToPoint(endPoint, dragStartContext);
    }
  }

  private dragMoveToPoint(endPoint: ClientPoint, dragStartContext: DragStartContext) {
    const startPoint = getPointFromEvent(dragStartContext.startEvent);
    if (startPoint) {
      const preDirOffset =
        this.direction() === 'horizontal' ? endPoint.x - startPoint.x : endPoint.y - startPoint.y;
      const offset =
        this.direction() === 'horizontal' && this.dir() === 'rtl' ? -preDirOffset : preDirOffset;
      const isDraggingForward = offset > 0;
      // Align offset with gutter step and abs it as we need absolute pixels movement
      const absSteppedOffset = Math.abs(Math.round(offset / this.gutterStep()) * this.gutterStep());
      // Copy as we don't want to edit the original array
      const tempPanesPixelSizes = [...dragStartContext.panesPixelSizes];
      // As we are going to shuffle the panes order for easier iterations we should work with pane indices array
      // instead of actual pane sizes array.
      const panesIndices = tempPanesPixelSizes.map((_, index) => index);
      // The two variables below are ordered for iterations with real pane indices inside.
      // We must also remove the invisible ones as we can't expand or shrink them.
      const panesIndicesBeforeGutter = this.restrictMove()
        ? [dragStartContext.paneBeforeGutterIndex]
        : panesIndices
            .slice(0, dragStartContext.paneBeforeGutterIndex + 1)
            .filter(index => this._panes()[index].visible())
            .reverse();
      const panesIndicesAfterGutter = this.restrictMove()
        ? [dragStartContext.paneAfterGutterIndex]
        : panesIndices
            .slice(dragStartContext.paneAfterGutterIndex)
            .filter(index => this._panes()[index].visible());
      // Based on direction we need to decide which panes are expanding and which are shrinking
      const potentialPanesIndicesArrToShrink = isDraggingForward
        ? panesIndicesAfterGutter
        : panesIndicesBeforeGutter;
      const potentialPanesIndicesArrToExpand = isDraggingForward
        ? panesIndicesBeforeGutter
        : panesIndicesAfterGutter;
      let remainingPixels = absSteppedOffset;
      let potentialShrinkArrIndex = 0;
      let potentialExpandArrIndex = 0;

      // We gradually run in both expand and shrink direction transferring pixels from the offset.
      // We stop once no pixels are left or we reached the end of either the expanding panes or the shrinking panes
      while (
        remainingPixels !== 0 &&
        potentialShrinkArrIndex < potentialPanesIndicesArrToShrink.length &&
        potentialExpandArrIndex < potentialPanesIndicesArrToExpand.length
      ) {
        const paneIndexToShrink = potentialPanesIndicesArrToShrink[potentialShrinkArrIndex];
        const paneIndexToExpand = potentialPanesIndicesArrToExpand[potentialExpandArrIndex];
        const paneToShrinkSize = tempPanesPixelSizes[paneIndexToShrink];
        const paneToExpandSize = tempPanesPixelSizes[paneIndexToExpand];
        const paneToShrinkMinSize = dragStartContext.paneIndexToBoundaries[paneIndexToShrink].min;
        const paneToExpandMaxSize = dragStartContext.paneIndexToBoundaries[paneIndexToExpand].max;
        // We can only transfer pixels based on the shrinking pane min size and the expanding pane max size
        // to avoid overflow. If any pixels left they will be handled by the next pane in the next `while` iteration
        const maxPixelsToShrink = paneToShrinkSize - paneToShrinkMinSize;
        const maxPixelsToExpand = paneToExpandMaxSize - paneToExpandSize;
        const pixelsToTransfer = Math.min(maxPixelsToShrink, maxPixelsToExpand, remainingPixels);

        // Actual pixels transfer
        tempPanesPixelSizes[paneIndexToShrink] -= pixelsToTransfer;
        tempPanesPixelSizes[paneIndexToExpand] += pixelsToTransfer;
        remainingPixels -= pixelsToTransfer;

        // Once min threshold reached we need to move to the next pane in turn
        if (tempPanesPixelSizes[paneIndexToShrink] === paneToShrinkMinSize) {
          potentialShrinkArrIndex++;
        }

        // Once max threshold reached we need to move to the next pane in turn
        if (tempPanesPixelSizes[paneIndexToExpand] === paneToExpandMaxSize) {
          potentialExpandArrIndex++;
        }
      }

      this._panes().forEach((pane, index) => {
        // No need to update wildcard size
        if (pane._internalSize() === '*') {
          return;
        }

        if (this.unit() === 'pixel') {
          pane._internalSize.set(tempPanesPixelSizes[index]);
        } else {
          const percentSize =
            (tempPanesPixelSizes[index] / dragStartContext.totalPanesPixelSize) * 100;
          // Fix javascript only working with float numbers which are inaccurate compared to decimals
          pane._internalSize.set(parseFloat(percentSize.toFixed(10)));
        }
      });

      const draggedGutterIndex = this.draggedGutterIndex();
      if (draggedGutterIndex !== undefined) {
        this.dragProgressSubject.next(this.createDragInteractionEvent(draggedGutterIndex));
      }
    }
  }

  private createGridTemplateColumnsStyle(): string {
    const columns: string[] = [];
    const sumNonWildcardSizes = sum(this._visiblePanes(), pane => {
      const size = pane._internalSize();
      return size === '*' ? 0 : size;
    });
    const visiblePanesCount = this._visiblePanes().length;

    let visitedVisiblePanes = 0;

    this._panes().forEach((pane, index, panes) => {
      const unit = this.unit();
      const paneSize = pane._internalSize();

      // Add pane size column
      if (!pane.visible()) {
        columns.push(unit === 'percent' || paneSize === '*' ? '0fr' : '0px');
      } else {
        if (unit === 'pixel') {
          const columnValue = paneSize === '*' ? '1fr' : `${paneSize}px`;
          columns.push(columnValue);
        } else {
          const percentSize = paneSize === '*' ? 100 - sumNonWildcardSizes : paneSize;
          const columnValue = `${percentSize}fr`;
          columns.push(columnValue);
        }

        visitedVisiblePanes++;
      }

      const isLastPane = index === panes.length - 1;

      if (isLastPane) {
        return;
      }

      const remainingVisiblePanes = visiblePanesCount - visitedVisiblePanes;

      // Only add gutter with size if this pane is visible and there are more visible panes after this one
      // to avoid ghost gutters
      if (pane.visible() && remainingVisiblePanes > 0) {
        columns.push(`${this.gutterSize()}px`);
      } else {
        columns.push('0px');
      }
    });

    return this.direction() === 'horizontal'
      ? `1fr / ${columns.join(' ')}`
      : `${columns.join(' ')} / 1fr`;
  }

  private createAlignedVisiblePanesSize(): MtxSplitPaneSize[] {
    const visiblePanesSizes = this._visiblePanes().map((pane): MtxSplitPaneSize => {
      const size = pane.size();
      return size === 'auto' ? '*' : size;
    });
    const isValid = arePanesValid(this._visiblePanes(), this.unit(), false);

    if (isValid) {
      return visiblePanesSizes;
    }

    const unit = this.unit();

    if (unit === 'percent') {
      // Distribute sizes equally
      const defaultPercentSize = 100 / visiblePanesSizes.length;
      return visiblePanesSizes.map(() => defaultPercentSize);
    }

    if (unit === 'pixel') {
      // Make sure only one wildcard pane
      const wildcardPanes = visiblePanesSizes.filter(paneSize => paneSize === '*');

      if (wildcardPanes.length === 0) {
        return ['*', ...visiblePanesSizes.slice(1)];
      } else {
        const firstWildcardIndex = visiblePanesSizes.findIndex(paneSize => paneSize === '*');
        const defaultPxSize = 100;

        return visiblePanesSizes.map((paneSize, index) =>
          index === firstWildcardIndex || paneSize !== '*' ? paneSize : defaultPxSize
        );
      }
    }

    return assertUnreachable(unit, 'SplitUnit');
  }
}
