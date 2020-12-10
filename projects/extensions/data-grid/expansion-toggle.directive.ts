import {
  Directive,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  TemplateRef,
} from '@angular/core';

@Directive({
  selector: '[mtx-expansion-toggle]',
})
export class MtxGridExpansionToggleDirective {
  private _opened = false;
  private _row: any;
  private _tplRef: TemplateRef<any>;

  @Input()
  get opened() {
    return this._opened;
  }
  set opened(newValue: boolean) {
    this._opened = newValue;
    this.openedChange.emit(newValue);
  }
  @Output() openedChange = new EventEmitter<boolean>();

  @HostBinding('class.expanded')
  get expended(): boolean {
    return this._opened;
  }

  @Input()
  set expandableRow(value: any) {
    if (value !== this._row) {
      this._row = value;
    }
  }

  @Input('expansionRowTpl')
  set template(value: TemplateRef<any>) {
    if (value !== this._tplRef) {
      this._tplRef = value;
    }
  }

  @Output() toggleChange = new EventEmitter<MtxGridExpansionToggleDirective>();

  constructor() {}

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  }

  toggle(): void {
    this.opened = !this.opened;
    this.toggleChange.emit(this);
  }
}
